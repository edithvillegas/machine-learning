import os
import cv2
from PIL import Image
import numpy as np

def process_images(input_dir, output_dir, target_size=(500, 500), padding_factor=1.8):
    os.makedirs(output_dir, exist_ok=True)
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    valid_extensions = ('.jpg', '.jpeg', '.png', '.bmp', '.webp')
    for filename in sorted(os.listdir(input_dir)):
        if not filename.lower().endswith(valid_extensions):
            continue
        input_path = os.path.join(input_dir, filename)
        output_path = os.path.join(output_dir, filename)
        img_pil = Image.open(input_path).convert('RGB')
        img = cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
        if len(faces) == 0:
            print(f"No face detected in {filename}. Resizing and centering image instead...")
            h_img, w_img = img.shape[:2]
            min_dim = min(h_img, w_img)
            x1 = (w_img - min_dim) // 2
            y1 = (h_img - min_dim) // 2
            cropped_img = img[y1:y1+min_dim, x1:x1+min_dim]
        else:
            x, y, w, h = faces[0]
            center_x = x + w // 2
            center_y = y + h // 2
            box_size = int(max(w, h) * padding_factor)
            x1 = max(0, center_x - box_size // 2)
            y1 = max(0, center_y - box_size // 2)
            cropped_img = img[y1:y1+box_size, x1:x1+box_size]
        if cropped_img.size == 0:
            print(f"Error cropping {filename}, skipping.")
            continue
        resized_img = cv2.resize(cropped_img, target_size, interpolation=cv2.INTER_CUBIC)
        cv2.imwrite(output_path, resized_img)
        print(f"Successfully processed and saved: {filename}")

if __name__ == "__main__":
    process_images("input", "images_output", target_size=(500, 500), padding_factor=2.0)
