import json
import os
import shutil
from datetime import datetime
from uuid import uuid4

from PIL import Image, ImageDraw

from app.config import BASE_DIR, SCREEN_WIDTH, SCREEN_HEIGHT


class ImageLibraryService:
    """图片库服务，负责上传、转换、保存与查询"""

    def __init__(self):
        self.storage_dir = os.path.join(BASE_DIR, "storage")
        self.library_dir = os.path.join(BASE_DIR, "pic", "library")
        self.library_file = os.path.join(self.storage_dir, "image_library.json")

        os.makedirs(self.storage_dir, exist_ok=True)
        os.makedirs(self.library_dir, exist_ok=True)

        if not os.path.exists(self.library_file):
            with open(self.library_file, "w", encoding="utf-8") as f:
                json.dump({}, f)

    def _load(self):
        with open(self.library_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def _save(self, data):
        with open(self.library_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def list_images(self):
        data = self._load()
        return list(data.values())

    def get_image(self, image_id):
        data = self._load()
        return data.get(image_id)

    def get_image_path(self, image_id):
        item = self.get_image(image_id)
        if not item:
            return None
        return os.path.join(self.library_dir, item["filename"])

    def delete_images(self, image_ids):
        data = self._load()
        deleted = 0
        for image_id in image_ids:
            item = data.pop(image_id, None)
            if item:
                deleted += 1
                path = os.path.join(self.library_dir, item["filename"])
                try:
                    if os.path.exists(path):
                        os.remove(path)
                except OSError:
                    pass
        self._save(data)
        return deleted

    def add_upload(self, file_storage):
        if file_storage is None or file_storage.filename == "":
            raise ValueError("No file provided")

        image = Image.open(file_storage.stream)
        image = image.convert("RGB")
        resized = image.resize((SCREEN_WIDTH, SCREEN_HEIGHT), Image.LANCZOS)

        image_id = uuid4().hex
        filename = f"{image_id}.bmp"
        save_path = os.path.join(self.library_dir, filename)
        resized.save(save_path, format="BMP")

        item = {
            "id": image_id,
            "filename": filename,
            "original_name": file_storage.filename,
            "created_at": datetime.utcnow().isoformat() + "Z",
            "status": "ready",
        }

        data = self._load()
        data[image_id] = item
        self._save(data)

        return item

    def add_pil_image(self, image, original_name="generated"):
        if image is None:
            raise ValueError("No image provided")

        image = image.convert("RGB")
        resized = image.resize((SCREEN_WIDTH, SCREEN_HEIGHT), Image.LANCZOS)

        image_id = uuid4().hex
        filename = f"{image_id}.bmp"
        save_path = os.path.join(self.library_dir, filename)
        resized.save(save_path, format="BMP")

        item = {
            "id": image_id,
            "filename": filename,
            "original_name": original_name,
            "created_at": datetime.utcnow().isoformat() + "Z",
            "status": "ready",
        }

        data = self._load()
        data[image_id] = item
        self._save(data)

        return item

    def add_placeholder(self, original_name, source_id=None, style=None):
        image_id = uuid4().hex
        filename = f"{image_id}.bmp"
        save_path = os.path.join(self.library_dir, filename)

        image = Image.new("RGB", (SCREEN_WIDTH, SCREEN_HEIGHT), color=(26, 26, 34))
        draw = ImageDraw.Draw(image)

        # 背景轻微纹理
        for x in range(0, SCREEN_WIDTH, 40):
            draw.line([(x, 0), (x, SCREEN_HEIGHT)], fill=(30, 30, 40))

        # 圆形“生成中”指示器
        cx = SCREEN_WIDTH // 2
        cy = SCREEN_HEIGHT // 2 - 20
        radius = 60
        draw.ellipse(
            [(cx - radius, cy - radius), (cx + radius, cy + radius)],
            outline=(120, 120, 140),
            width=4
        )
        draw.arc(
            [(cx - radius, cy - radius), (cx + radius, cy + radius)],
            start=300,
            end=40,
            fill=(6, 182, 212),
            width=6
        )

        text = "生成中..."
        bbox = draw.textbbox((0, 0), text)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        draw.text(
            (cx - text_w / 2, cy + radius + 16),
            text,
            fill=(220, 220, 235),
        )
        image.save(save_path, format="BMP")

        item = {
            "id": image_id,
            "filename": filename,
            "original_name": original_name,
            "created_at": datetime.utcnow().isoformat() + "Z",
            "status": "processing",
            "source_id": source_id,
            "style": style,
        }

        data = self._load()
        data[image_id] = item
        self._save(data)
        return item

    def update_item(self, image_id, updates, image=None):
        data = self._load()
        item = data.get(image_id)
        if not item:
            return None

        if image is not None:
            image = image.convert("RGB")
            resized = image.resize((SCREEN_WIDTH, SCREEN_HEIGHT), Image.LANCZOS)
            save_path = os.path.join(self.library_dir, item["filename"])
            resized.save(save_path, format="BMP")

        item.update(updates)
        data[image_id] = item
        self._save(data)
        return item

    def add_existing_file(self, source_path, original_name="generated"):
        if not source_path or not os.path.exists(source_path):
            raise ValueError("Source file not found")

        image_id = uuid4().hex
        filename = f"{image_id}.bmp"
        dest_path = os.path.join(self.library_dir, filename)
        shutil.copyfile(source_path, dest_path)

        item = {
            "id": image_id,
            "filename": filename,
            "original_name": original_name,
            "created_at": datetime.utcnow().isoformat() + "Z",
        }

        data = self._load()
        data[image_id] = item
        self._save(data)

        return item
