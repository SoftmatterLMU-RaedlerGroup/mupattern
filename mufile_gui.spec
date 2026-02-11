# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for mufile GUI. No PyTorch.
# Build from repo root: uv run pyinstaller mufile_gui.spec

from PyInstaller.utils.hooks import copy_metadata

block_cipher = None

a = Analysis(
    ["scripts/mufile_gui_entry.py"],
    pathex=[],
    binaries=[],
    datas=copy_metadata("imageio"),
    hiddenimports=[
        "mufile",
        "mufile.core",
        "mufile.gui",
        "customtkinter",
        "nd2",
        "imageio",
        "imageio_ffmpeg",
        "tifffile",
        "zarr",
        "numpy",
        "matplotlib",
        "matplotlib.pyplot",
        "matplotlib.cm",
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
    name="mufile-gui",
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
