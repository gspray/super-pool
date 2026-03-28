"""
pre_gen_ui.py — PlatformIO extra_scripts pre-script
Converts esp32/data/index.html → esp32/include/ui_html.h before each build.
Edit data/index.html; the header is auto-regenerated.
"""
import os

Import("env")  # noqa: F821 — PlatformIO injects this

data_dir   = os.path.join(env["PROJECT_DIR"], "data", "index.html")
header_out = os.path.join(env["PROJECT_DIR"], "include", "ui_html.h")

if not os.path.exists(data_dir):
    print("[gen_ui] data/index.html not found — skipping")
else:
    with open(data_dir, "r", encoding="utf-8") as f:
        html = f.read()

    # Escape anything that would break a C++ raw string with delimiter =====
    html = html.replace(")=====", ") ====")

    header = (
        "#pragma once\n"
        "// AUTO-GENERATED from data/index.html — do not edit directly\n"
        "// Re-generated every build by pre_gen_ui.py\n"
        "static const char UI_HTML[] PROGMEM = R\"=====(\n"
        + html +
        "\n)=====\";\n"
    )

    os.makedirs(os.path.dirname(header_out), exist_ok=True)
    with open(header_out, "w", encoding="utf-8") as f:
        f.write(header)

    print(f"[gen_ui] Generated include/ui_html.h ({len(html)} bytes)")
