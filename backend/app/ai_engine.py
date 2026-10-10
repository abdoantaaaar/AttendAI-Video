import json
from dotenv import load_dotenv

load_dotenv()
import os
from io import BytesIO
from typing import Iterable

import numpy as np
from PIL import Image


class FaceEngine:
    def __init__(self):
        self.threshold = float(os.getenv("FACE_MATCH_THRESHOLD", "0.65"))
        self._loaded = False
        self.device = None
        self.detector = None
        self.aligner = None
        self.model = None
        self.trackers = {}

    def _ensure_loaded(self):
        if self._loaded:
            return

        import torch
        from facenet_pytorch import MTCNN, InceptionResnetV1

        self.device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
        self.detector = MTCNN(keep_all=True, min_face_size=40, device=self.device)
        self.aligner = MTCNN(
            image_size=160,
            margin=14,
            keep_all=False,
            post_process=True,
            device=self.device,
        )
        self.model = InceptionResnetV1(pretrained="vggface2").eval().to(self.device)
        self._loaded = True

    @staticmethod
    def embedding_from_json(value: str) -> np.ndarray:
        arr = np.asarray(json.loads(value), dtype=np.float32)
        norm = np.linalg.norm(arr)
        return arr / norm if norm else arr

    @staticmethod
    def embedding_to_json(value: np.ndarray) -> str:
        return json.dumps(value.astype(float).tolist())

    def _tensor_to_embedding(self, face_tensor):
        import torch
        if face_tensor is None:
            return None
        with torch.no_grad():
            emb = self.model(face_tensor.unsqueeze(0).to(self.device))
        arr = emb.squeeze(0).cpu().numpy().astype(np.float32)
        norm = np.linalg.norm(arr)
        return (arr / norm) if norm else None

    def _embedding_for_box(self, image: Image.Image, box):
        x1, y1, x2, y2 = [float(v) for v in box]
        w, h = image.size
        bw = max(1.0, x2 - x1)
        bh = max(1.0, y2 - y1)
        pad_x = bw * 0.12
        pad_y = bh * 0.12
        crop_box = (
            max(0, int(x1 - pad_x)),
            max(0, int(y1 - pad_y)),
            min(w, int(x2 + pad_x)),
            min(h, int(y2 + pad_y)),
        )
        crop = image.crop(crop_box)
        face_tensor = self.aligner(crop)
        return self._tensor_to_embedding(face_tensor)

    def enroll_images(self, image_bytes_list: Iterable[bytes], min_samples: int = 1) -> tuple[np.ndarray, int]:
        self._ensure_loaded()
        embeddings = []

        for raw in image_bytes_list:
            try:
                image = Image.open(BytesIO(raw)).convert("RGB")
            except Exception:
                continue

            boxes, probs = self.detector.detect(image)
            if boxes is None or len(boxes) == 0:
                continue

            probs = np.asarray(probs, dtype=np.float32)
            valid = [i for i, p in enumerate(probs) if not np.isnan(p) and float(p) >= 0.90]
            if not valid:
                continue

            best_idx = max(valid, key=lambda i: float(probs[i]))
            emb = self._embedding_for_box(image, boxes[best_idx])
            if emb is not None:
                embeddings.append(emb)

        if len(embeddings) < min_samples:
            raise ValueError(
                f"Need at least {min_samples} clear face sample(s). Use a well-lit front-facing image."
            )

        avg = np.mean(np.stack(embeddings, axis=0), axis=0)
        norm = np.linalg.norm(avg)
        if norm == 0:
            raise ValueError("Could not build a valid face embedding")
        return (avg / norm).astype(np.float32), len(embeddings)

    def _tracked_boxes(self, boxes, probs, session_key: str):
        if len(boxes) == 0:
            return []
        try:
            import supervision as sv
            tracker = self.trackers.get(session_key)
            if tracker is None:
                tracker = sv.ByteTrack()
                self.trackers[session_key] = tracker

            detections = sv.Detections(
                xyxy=np.asarray(boxes, dtype=np.float32),
                confidence=np.asarray(probs, dtype=np.float32),
                class_id=np.zeros(len(boxes), dtype=int),
            )
            tracked = tracker.update_with_detections(detections)
            if tracked.tracker_id is None:
                return []
            return [
                (box, float(confidence), int(track_id))
                for box, confidence, track_id in zip(
                    tracked.xyxy, tracked.confidence, tracked.tracker_id
                )
            ]
        except Exception:
            return [(box, float(prob), None) for box, prob in zip(boxes, probs)]

    def recognize_frame(self, raw: bytes, candidates: list[dict], session_key: str) -> dict:
        self._ensure_loaded()
        image = Image.open(BytesIO(raw)).convert("RGB")
        width, height = image.size
        boxes, probs = self.detector.detect(image)

        if boxes is None:
            return {"frame_width": width, "frame_height": height, "faces": []}

        filtered_boxes, filtered_probs = [], []
        for box, prob in zip(boxes, probs):
            if prob is not None and float(prob) >= 0.90:
                filtered_boxes.append(box)
                filtered_probs.append(prob)

        tracked = self._tracked_boxes(filtered_boxes, filtered_probs, session_key)
        recognized = []

        for box, detection_confidence, track_id in tracked:
            emb = self._embedding_for_box(image, box)
            if emb is None:
                continue

            best, best_score = None, -1.0
            for candidate in candidates:
                score = float(np.dot(emb, candidate["embedding"]))
                if score > best_score:
                    best_score, best = score, candidate

            known = best is not None and best_score >= self.threshold
            x1, y1, x2, y2 = [int(v) for v in box]
            recognized.append({
                "track_id": track_id,
                "bbox": [x1, y1, x2, y2],
                "detection_confidence": round(detection_confidence, 4),
                "user_id": best["user_id"] if known else None,
                "student_id": best["student_id"] if known else None,
                "name": best["name"] if known else "Unknown",
                "similarity": round(best_score, 4),
            })

        return {"frame_width": width, "frame_height": height, "faces": recognized}

    def reset_session_tracker(self, session_key: str):
        self.trackers.pop(session_key, None)


face_engine = FaceEngine()
