# -*- coding: utf-8 -*-
"""
给 index.html 里的静态资源加内容哈希版本号（缓存失效标记）。

原理：
  href="css/style.css"  ->  href="css/style.css?v=a1b2c3d4"
  其中 v 取该文件内容的 sha256 前 8 位。文件一改，v 就变，URL 变化后
  浏览器必然重新下载，彻底绕开启发式缓存（服务器未下发 Cache-Control）。

可重复执行：每次先剥离已有的 ?v=，再按当前内容重新计算，因此不会叠加。
"""
import hashlib
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # 项目根目录
INDEX = os.path.join(ROOT, "index.html")

# 需要加版本号的资源类型（本地相对路径）
PATTERN = re.compile(
    r'(?P<attr>(?:href|src))="(?P<path>(?!#|https?:|data:|mailto:)'
    r'[^"?]+\.(?:css|js|svg|woff2|jpg|png|json))(?:\?v=[0-9a-f]+)?"'
)


def digest(rel_path):
    """取文件内容 sha256 前 8 位；文件不存在返回 None"""
    p = os.path.join(ROOT, rel_path.replace("/", os.sep))
    if not os.path.isfile(p):
        return None
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()[:8]


def main():
    with open(INDEX, encoding="utf-8") as f:
        html = f.read()

    missing, stamped = [], []

    def repl(m):
        attr, path = m.group("attr"), m.group("path")
        v = digest(path)
        if v is None:
            missing.append(path)
            return m.group(0)
        stamped.append((path, v))
        return f'{attr}="{path}?v={v}"'

    new_html = PATTERN.sub(repl, html)

    if missing:
        print("警告：以下资源不存在，未加版本号")
        for p in missing:
            print("  -", p)

    with open(INDEX, "w", encoding="utf-8") as f:
        f.write(new_html)

    print(f"已为 {len(stamped)} 个资源写入版本号：")
    for p, v in stamped:
        print(f"  {v}  {p}")


if __name__ == "__main__":
    main()
