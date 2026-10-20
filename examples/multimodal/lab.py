"""Generated media metadata only. No vision, ASR, generation, or private files."""
import base64
import io
import math
import wave


def _number(value):
    return type(value) in (int, float) and math.isfinite(value)


def crop_box(width, height, left, top, right, bottom):
    values = (width, height, left, top, right, bottom)
    if any(type(x) is not int for x in values) or not (0 <= left < right <= width and 0 <= top < bottom <= height):
        raise ValueError("裁剪框需为原图范围内的整数坐标")
    return {"left": left, "top": top, "right": right, "bottom": bottom,
            "width": right-left, "height": bottom-top}


def audio_demo():
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(8000)
        output.writeframes(b"\x00\x00" * 8000)
    with wave.open(io.BytesIO(buffer.getvalue()), "rb") as sound:
        return {"channels": sound.getnchannels(), "sample_rate": sound.getframerate(),
                "frames": sound.getnframes(), "seconds": sound.getnframes()/sound.getframerate(), "mode": "generated_silence"}


def sample_times(duration, interval):
    if not _number(duration) or not _number(interval) or duration <= 0 or interval <= 0:
        raise ValueError("时长与间隔需为有限正数")
    count = math.ceil(duration / interval)
    if count > 10000:
        raise ValueError("教学示例最多生成一万个采样时刻")
    return [round(index*interval, 6) for index in range(count) if index*interval < duration]


def overlap(a, b):
    for pair in (a, b):
        if len(pair) != 2 or not all(_number(value) for value in pair) or not 0 <= pair[0] <= pair[1]:
            raise ValueError("时间范围无效")
    return max(0.0, min(a[1], b[1]) - max(a[0], b[0]))


if __name__ == "__main__":
    print("仅本地生成数据与计算，不进行真实媒体识别。")
    print("Base64：", base64.b64encode(b"course").decode())
    print("裁剪：", crop_box(1920, 1080, 100, 80, 900, 600))
    print("音频：", audio_demo())
    print("取帧计划：", sample_times(12, 3))
    print("时间重叠：", overlap((2, 5), (4, 7)))
