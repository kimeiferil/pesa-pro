# fix-encoding.ps1
# Run: .\fix-encoding.ps1

Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Text;
using System.Collections.Generic;

public class EncodingFixer {
    public static int FixDirectory(string srcPath) {
        int count = 0;
        
        var replacements = new List<KeyValuePair<byte[], byte[]>> {
            new KeyValuePair<byte[], byte[]>(
                new byte[]{ 0xC3,0xB0,0xC5,0xB8,0xC5,0xA1,0xE2,0x82,0xAC },
                new byte[]{ 0xF0,0x9F,0x9A,0x80 }
            ),
            new KeyValuePair<byte[], byte[]>(
                new byte[]{ 0xC3,0xA2,0xC2,0x9C,0x22 },
                new byte[]{ 0xE2,0x9C,0x93 }
            ),
            new KeyValuePair<byte[], byte[]>(
                new byte[]{ 0xC3,0x82,0xC5,0x92,0x22 },
                new byte[]{ 0xE2,0x9C,0x93 }
            ),
            new KeyValuePair<byte[], byte[]>(
                new byte[]{ 0xC3,0xB0,0xC5,0xB8,0xE2,0x80,0x9D,0xE2,0x80,0x99 },
                new byte[]{ 0xF0,0x9F,0x94,0x92 }
            ),
            new KeyValuePair<byte[], byte[]>(
                new byte[]{ 0xC3,0xA2,0xE2,0x80,0xA0,0xE2,0x80,0x99 },
                new byte[]{ 0xE2,0x86,0x92 }
            ),
            new KeyValuePair<byte[], byte[]>(
                new byte[]{ 0xC3,0xA2,0xE2,0x80,0xA0,0xE2,0x80,0x9D },
                new byte[]{ 0xE2,0x86,0x93 }
            ),
            new KeyValuePair<byte[], byte[]>(
                new byte[]{ 0xC3,0xA2,0xE2,0x80,0xA0,0xE2,0x80,0x98 },
                new byte[]{ 0xE2,0x86,0x91 }
            ),
            new KeyValuePair<byte[], byte[]>(
                new byte[]{ 0xC3,0xA2,0xC2,0x80,0xC2,0x94 },
                new byte[]{ 0xE2,0x80,0x94 }
            ),
            new KeyValuePair<byte[], byte[]>(
                new byte[]{ 0xC3,0x82,0xC2,0xB7 },
                new byte[]{ 0xC2,0xB7 }
            ),
            new KeyValuePair<byte[], byte[]>(
                new byte[]{ 0xC3,0xB0,0xC5,0xB8,0xE2,0x80,0x9D,0xC2,0xB1 },
                new byte[]{ 0xF0,0x9F,0x93,0xB1 }
            ),
            new KeyValuePair<byte[], byte[]>(
                new byte[]{ 0xC3,0xB0,0xC5,0xB8,0xE2,0x80,0x99,0xC2,0xB0 },
                new byte[]{ 0xF0,0x9F,0x92,0xB0 }
            ),
            new KeyValuePair<byte[], byte[]>(
                new byte[]{ 0xC3,0xB0,0xC5,0xB8,0xC5,0xBD,0xE2,0x80,0xB0 },
                new byte[]{ 0xF0,0x9F,0x8E,0x89 }
            ),
        };

        string[] extensions = new string[]{ ".ts", ".tsx" };
        string[] files = Directory.GetFiles(srcPath, "*.*", SearchOption.AllDirectories);

        foreach (string file in files) {
            string ext = Path.GetExtension(file).ToLower();
            bool isTs = false;
            foreach (string e in extensions) { if (ext == e) { isTs = true; break; } }
            if (!isTs) continue;
            
            try {
                byte[] data = File.ReadAllBytes(file);
                byte[] result = ReplaceAll(data, replacements);
                
                if (!BytesEqual(data, result)) {
                    File.WriteAllBytes(file, result);
                    Console.WriteLine("  Fixed: " + file.Replace(srcPath, "").TrimStart('\\').TrimStart('/'));
                    count++;
                }
            } catch (Exception ex) {
                Console.WriteLine("  Error: " + Path.GetFileName(file) + " - " + ex.Message);
            }
        }
        return count;
    }

    static byte[] ReplaceAll(byte[] data, List<KeyValuePair<byte[], byte[]>> replacements) {
        foreach (var rep in replacements) {
            data = Replace(data, rep.Key, rep.Value);
        }
        return data;
    }

    static byte[] Replace(byte[] data, byte[] find, byte[] replace) {
        var result = new List<byte>();
        int i = 0;
        while (i < data.Length) {
            if (i <= data.Length - find.Length && Match(data, i, find)) {
                result.AddRange(replace);
                i += find.Length;
            } else {
                result.Add(data[i]);
                i++;
            }
        }
        return result.ToArray();
    }

    static bool Match(byte[] data, int start, byte[] pattern) {
        for (int i = 0; i < pattern.Length; i++) {
            if (data[start + i] != pattern[i]) return false;
        }
        return true;
    }

    static bool BytesEqual(byte[] a, byte[] b) {
        if (a.Length != b.Length) return false;
        for (int i = 0; i < a.Length; i++) { if (a[i] != b[i]) return false; }
        return true;
    }
}
"@

Write-Host "Scanning src/ for garbled characters..." -ForegroundColor Cyan

$srcPath = Join-Path $PSScriptRoot "src"
$count = [EncodingFixer]::FixDirectory($srcPath)

Write-Host ""
Write-Host "Done. Fixed $count file(s)." -ForegroundColor Green

if ($count -gt 0) {
    Write-Host "Committing to GitHub..." -ForegroundColor Cyan
    git add -A
    git commit -m "fix: correct garbled UTF-8 characters across source files"
    git push origin main
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Pushed. Vercel will redeploy automatically." -ForegroundColor Green
    } else {
        Write-Host "Git push failed. Run: git push origin main" -ForegroundColor Red
    }
} else {
    Write-Host "No changes found." -ForegroundColor Gray
}