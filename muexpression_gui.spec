# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for muexpression GUI. No PyTorch.
# Build from repo root: uv run pyinstaller muexpression_gui.spec

block_cipher = None

a = Analysis(
    ["scripts/muexpression_gui_entry.py"],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[
        "muexpression",
        "muexpression.core",
        "muexpression.gui",
        "customtkinter",
        "zarr",
        "numpy",
        "pandas",
        "yaml",
        "matplotlib",
        "matplotlib.pyplot",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["torch", "torchvision", "torchaudio"],
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="muexpression-gui",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
