"""
fix_encoding.py
Run from your project root: python fix_encoding.py
"""
import os
import subprocess

# Map of garbled sequences -> correct UTF-8
# These are double-encoded UTF-8 strings (UTF-8 read as Latin-1 then re-encoded)
REPLACEMENTS = {
    # Rocket emoji 🚀
    "\u00c3\u00b0\u00c5\u00b8\u00c5\u00a1\u20ac": "\U0001F680",
    # Checkmark ✓
    "\u00e2\u009c\u201d": "\u2713",
    # Checkmark variant ✓ (ÂŒ")
    "\u00c2\u008c\u201d": "\u2713",
    # Checkmark variant (âœ")
    "\u00e2\u009c\u0022": "\u2713",
    # Arrow right →
    "\u00e2\u2020\u2019": "\u2192",
    # Arrow down ↓
    "\u00e2\u2020\u201d": "\u2193",
    # Arrow up ↑
    "\u00e2\u2020\u2018": "\u2191",
    # Lock emoji 🔒
    "\u00c3\u00b0\u00c5\u00b8\u201d\u2019": "\U0001F512",
    # Phone emoji 📱
    "\u00c3\u00b0\u00c5\u00b8\u201d\u00b1": "\U0001F4F1",
    # Money emoji 💰
    "\u00c3\u00b0\u00c5\u00b8\u2019\u00b0": "\U0001F4B0",
    # Chart emoji 📊
    "\u00c3\u00b0\u00c5\u00b8\u201d\u008a": "\U0001F4CA",
    # People emoji 👥
    "\u00c3\u00b0\u00c5\u00b8\u2019\u00a5": "\U0001F465",
    # Party emoji 🎉
    "\u00c3\u00b0\u00c5\u00b8\u017d\u2030": "\U0001F389",
    # Em dash —
    "\u00e2\u0080\u0094": "\u2014",
    # Middle dot ·
    "\u00c2\u00b7": "\u00b7",
    # Box drawing ─
    "\u00e2\u0094\u0080": "\u2500",
    # Double line ═
    "\u00e2\u0095\u0090": "\u2550",
}

def fix_file(path):
    try:
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            original = f.read()

        content = original
        for garbled, correct in REPLACEMENTS.items():
            content = content.replace(garbled, correct)

        if content != original:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
    except Exception as e:
        print(f"  Error: {path} - {e}")
    return False

def main():
    print("Scanning src/ for encoding issues...")
    fixed = 0
    src_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src')

    for root, dirs, files in os.walk(src_dir):
        for fname in files:
            if fname.endswith(('.ts', '.tsx')):
                path = os.path.join(root, fname)
                if fix_file(path):
                    rel = os.path.relpath(path)
                    print(f"  Fixed: {rel}")
                    fixed += 1

    print(f"\nDone. Fixed {fixed} file(s).")

    if fixed > 0:
        print("Committing to GitHub...")
        subprocess.run(['git', 'add', '-A'])
        subprocess.run(['git', 'commit', '-m', 'fix: correct garbled UTF-8 characters'])
        result = subprocess.run(['git', 'push', 'origin', 'main'])
        if result.returncode == 0:
            print("Pushed. Vercel will redeploy automatically.")
        else:
            print("Git push failed. Run: git push origin main")
    else:
        print("No files changed - nothing to commit.")

if __name__ == '__main__':
    main()