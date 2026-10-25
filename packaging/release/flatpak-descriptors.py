"""Create conventional Software installation descriptors with the repository public key."""
import base64
from pathlib import Path
import sys

key, destination, url = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
encoded = base64.b64encode(key.read_bytes()).decode()
(destination / "nahhasio.flatpakrepo").write_text(
    f"[Flatpak Repo]\nTitle=Nahhasio Alpha\nUrl={url}\nGPGKey={encoded}\n"
)
(destination / "nahhasio.flatpakref").write_text(
    f"[Flatpak Ref]\nName=io.nahhasio.Linux\nBranch=alpha\nTitle=Nahhasio\n"
    f"Url={url}\nIsRuntime=false\nSuggestRemoteName=nahhasio-alpha\nGPGKey={encoded}\n"
    "RuntimeRepo=https://dl.flathub.org/repo/flathub.flatpakrepo\n"
)
