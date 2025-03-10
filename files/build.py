import os
import sys
import subprocess
import shutil
from pathlib import Path

def build_exe():
    # Get paths
    script_dir = Path(__file__).parent
    utils_dir = script_dir.parent.parent / 'utils'
    icon_path = script_dir.parent.parent / 'files' / 'ico' / 'xlauncherplus.ico'
    
    if not icon_path.exists():
        print(f"Error: Icon not found at {icon_path}")
        sys.exit(1)

    # Create utils directory if it doesn't exist
    utils_dir.mkdir(parents=True, exist_ok=True)

    # PyInstaller command
    cmd = [
        'pyinstaller',
        '--onefile',                    # Create single executable
        '--noconsole',                  # No console window
        f'--icon={icon_path}',          # Set icon
        '--name=xlu',                   # Output name
        '--clean',                      # Clean build files
        # Version info
        '--version-file=version.txt',
        'xlu.py'
    ]

    try:
        # Create version info file
        version_info = f'''
VSVersionInfo(
  ffi=FixedFileInfo(
    filevers=(1, 0, 0, 0),
    prodvers=(1, 0, 0, 0),
    mask=0x3f,
    flags=0x0,
    OS=0x40004,
    fileType=0x1,
    subtype=0x0,
    date=(0, 0)
  ),
  kids=[
    StringFileInfo([
      StringTable(
        u'040904B0',
        [StringStruct(u'CompanyName', u'Xaein Daei'),
         StringStruct(u'FileDescription', u'xLauncher Plus Updater'),
         StringStruct(u'FileVersion', u'1.0.0'),
         StringStruct(u'InternalName', u'xlu'),
         StringStruct(u'LegalCopyright', u'Copyright (c) 2024 Xaein Daei'),
         StringStruct(u'OriginalFilename', u'xlu.exe'),
         StringStruct(u'ProductName', u'xLauncher Plus'),
         StringStruct(u'ProductVersion', u'1.0.0')])
    ]),
    VarFileInfo([VarStruct(u'Translation', [1033, 1200])])
  ]
)
'''
        with open('version.txt', 'w') as f:
            f.write(version_info)

        # Run PyInstaller
        subprocess.run(cmd, check=True)

        # Move executable to utils directory
        exe_path = script_dir / 'dist' / 'xlu.exe'
        if exe_path.exists():
            shutil.move(str(exe_path), str(utils_dir / 'xlu.exe'))
            print(f"Moved executable to: {utils_dir / 'xlu.exe'}")

        # Clean up build files
        build_dirs = ['build', 'dist', '__pycache__']
        build_files = ['version.txt', 'xlu.spec']
        
        for dir_name in build_dirs:
            dir_path = script_dir / dir_name
            if dir_path.exists():
                shutil.rmtree(dir_path)
                print(f"Cleaned up directory: {dir_name}")
        
        for file_name in build_files:
            file_path = script_dir / file_name
            if file_path.exists():
                file_path.unlink()
                print(f"Cleaned up file: {file_name}")
        
        print("\nBuild completed successfully!")

    except Exception as e:
        print(f"Build failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    build_exe() 