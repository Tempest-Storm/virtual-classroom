# Face model weights

The browser runs detection and embedding locally, so the weights have to be
served from this folder. They are not committed — download them once:

```bash
cd web/public/models
BASE=https://raw.githubusercontent.com/vladmandic/face-api/master/model

for f in tiny_face_detector_model-weights_manifest.json \
         tiny_face_detector_model.bin \
         face_landmark_68_tiny_model-weights_manifest.json \
         face_landmark_68_tiny_model.bin \
         face_recognition_model-weights_manifest.json \
         face_recognition_model-shard1 \
         face_recognition_model-shard2; do
  curl -sSLO "$BASE/$f"
done
```

Total download is about 6.5 MB. Without these files the app still works —
face enrolment and automated attendance simply report that the model is
unavailable, and teachers mark attendance manually.
