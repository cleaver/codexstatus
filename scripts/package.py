"""Create source-tree extension archives with stable package layouts."""

from pathlib import Path
import sys
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"


def add_tree(archive: ZipFile, directory: Path, prefix: str = "") -> None:
    for source in sorted(path for path in directory.rglob("*") if path.is_file()):
        if "__pycache__" in source.parts or source.name.endswith((".pyc", ".log")):
            continue
        archive_name = Path(prefix) / source.relative_to(directory)
        archive.write(source, archive_name.as_posix())


def main() -> None:
    DIST.mkdir(exist_ok=True)
    vicinae_output = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DIST / "codex-status-vicinae"
    with ZipFile(DIST / "codex-status@local.zip", "w", ZIP_DEFLATED) as archive:
        add_tree(archive, ROOT / "gnome-extension")
    with ZipFile(DIST / "codex-status-vicinae.zip", "w", ZIP_DEFLATED) as archive:
        add_tree(archive, vicinae_output, "codex-status")
    print("Packaged dist/codex-status@local.zip")
    print("Packaged dist/codex-status-vicinae.zip")


if __name__ == "__main__":
    main()
