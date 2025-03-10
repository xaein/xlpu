import os
import sys
import json
import shutil
import subprocess
import ctypes
from pathlib import Path
from elevate import elevate # type: ignore

class UpdateManager:
    def __init__(self):
        self.exe_path = Path(sys.executable)
        self.utils_dir = self.exe_path.parent
        self.app_dir = self.utils_dir.parent  # resources/app directory
        self.update_dir = self.utils_dir / 'updtmp'
        self.xldbu_path = self.utils_dir / 'xldbu.json'
        self.xldbv_path = self.utils_dir / 'xldbv.json'
        # Get the root installation directory (parent of resources)
        self.install_dir = self.app_dir.parent.parent
        
        print(f"Executable path: {self.exe_path}")
        print(f"Utils directory: {self.utils_dir}")
        print(f"App directory: {self.app_dir}")
        print(f"Update directory: {self.update_dir}")
        print(f"Installation directory: {self.install_dir}")

    def check_admin(self):
        """Ensure running with admin privileges"""
        try:
            elevate(graphical=False)
            print("Admin privileges obtained")
        except Exception as e:
            print(f"Failed to elevate privileges: {e}")
            sys.exit(1)

    def cleanup_misplaced_directories(self):
        """Clean up misplaced files and utils directories in the installation root"""
        try:
            misplaced_dirs = ['files', 'utils']
            for dir_name in misplaced_dirs:
                misplaced_dir = self.install_dir / dir_name
                if not misplaced_dir.exists():
                    continue

                print(f"\nChecking misplaced directory: {misplaced_dir}")
                
                try:
                    # If directory is empty, remove it immediately
                    if not any(misplaced_dir.iterdir()):
                        print(f"Removing empty directory: {misplaced_dir}")
                        misplaced_dir.rmdir()
                        continue

                    # If directory has contents, move them to the correct location
                    print(f"Moving contents from {misplaced_dir} to {self.app_dir}")
                    for item in misplaced_dir.iterdir():
                        target_path = self.app_dir / dir_name / item.name
                        target_path.parent.mkdir(parents=True, exist_ok=True)
                        
                        try:
                            if item.is_file():
                                shutil.move(str(item), str(target_path))
                            else:
                                # For directories, move contents recursively
                                if target_path.exists():
                                    shutil.rmtree(target_path)
                                shutil.move(str(item), str(target_path))
                        except Exception as move_error:
                            print(f"Error moving {item}: {move_error}")
                            continue

                    # After moving contents (or if any moves failed), ensure directory is removed
                    if misplaced_dir.exists():
                        # Double check if it's now empty
                        if not any(misplaced_dir.iterdir()):
                            print(f"Removing now empty directory: {misplaced_dir}")
                            misplaced_dir.rmdir()
                        else:
                            # If still not empty, try force remove
                            print(f"Forcing removal of directory: {misplaced_dir}")
                            shutil.rmtree(misplaced_dir)
                            
                    print(f"Cleaned up {dir_name} directory")

                except Exception as dir_error:
                    print(f"Error processing directory {dir_name}: {dir_error}")
                    # Try force remove even if other operations failed
                    if misplaced_dir.exists():
                        try:
                            shutil.rmtree(misplaced_dir)
                            print(f"Force removed directory: {misplaced_dir}")
                        except Exception as rm_error:
                            print(f"Failed to force remove directory {misplaced_dir}: {rm_error}")

        except Exception as e:
            print(f"Error during directory cleanup: {e}")

    def handle_update_process(self):
        """Process updates from updtmp directory"""
        try:
            if self.xldbu_path.exists():
                print("Processing xldbu.json...")
                self.process_removals()

            if self.update_dir.exists():
                print("Copying update files...")
                self.copy_update_files()
                
                if self.needs_theme_recompile():
                    print("Theme files found, recompiling...")
                    self.recompile_theme()

            # Add cleanup step after update process
            print("\nChecking for misplaced directories...")
            self.cleanup_misplaced_directories()

            return True
        except Exception as e:
            print(f"Update process failed: {e}")
            return False

    def process_removals(self):
        """Process file and dependency removals from xldbu.json"""
        try:
            with open(self.xldbu_path) as f:
                xldbu = json.load(f)

            # Remove files
            if 'FilesToRemove' in xldbu:
                for file in xldbu['FilesToRemove']:
                    self.remove_file(file)

            # Remove dependencies
            if 'RemovedDependencies' in xldbu:
                node_modules = self.app_dir / 'node_modules'
                for dep in xldbu['RemovedDependencies']:
                    dep_path = node_modules / dep
                    if dep_path.exists():
                        shutil.rmtree(dep_path)

            # Delete xldbu.json after processing
            self.xldbu_path.unlink()
        except Exception as e:
            print(f"Failed to process removals: {e}")

    def copy_update_files(self):
        """Copy files from updtmp to app directory"""
        try:
            print("\nStarting file copy process:")
            print(f"From: {self.update_dir}")
            print(f"To: {self.app_dir}\n")
            
            for src_path in self.update_dir.rglob('*'):
                if src_path.is_file():
                    # Skip xlu.exe since we're currently running it
                    if src_path.name == 'xlu.exe':
                        print(f"Skipping: {src_path.name}")
                        continue

                    rel_path = src_path.relative_to(self.update_dir)
                    # Ensure we're copying to resources/app, not root
                    dst_path = self.app_dir / rel_path
                    
                    print(f"Copying: {rel_path}")
                    print(f"To: {dst_path}")
                    
                    dst_path.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(src_path, dst_path)

            print("\nCleaning up updtmp directory...")
            shutil.rmtree(self.update_dir)
            print("Cleanup complete")
        except Exception as e:
            print(f"Failed to copy update files: {e}")
            print(f"Error details: {str(e)}")

    def needs_theme_recompile(self):
        """Check if any theme files were updated"""
        theme_extensions = {'.thm', '.scss'}
        for ext in theme_extensions:
            if any(self.update_dir.rglob(f'*{ext}')):
                return True
        return False

    def recompile_theme(self):
        """Recompile theme using xltb.exe"""
        try:
            # Read current theme from xldbv.json
            if self.xldbv_path.exists():
                with open(self.xldbv_path) as f:
                    xldbv = json.load(f)
                    current_theme = xldbv.get('configOpts', {}).get('theme', {}).get('currentTheme')
                    
                    if current_theme:
                        xltb_path = self.utils_dir / 'xltb.exe'
                        if xltb_path.exists():
                            subprocess.run([str(xltb_path), current_theme])
        except Exception as e:
            print(f"Theme recompilation failed: {e}")

    def handle_path_operation(self, action):
        """Add or remove utils directory from PATH"""
        import winreg
        
        if action not in {'add', 'remove'}:
            return False

        try:
            key = winreg.OpenKey(
                winreg.HKEY_LOCAL_MACHINE,
                r'SYSTEM\CurrentControlSet\Control\Session Manager\Environment',
                0,
                winreg.KEY_ALL_ACCESS
            )

            path = winreg.QueryValueEx(key, 'Path')[0]
            paths = path.split(';')
            utils_path = str(self.utils_dir)
            
            if action == 'add' and utils_path not in paths:
                paths.append(utils_path)
            elif action == 'remove' and utils_path in paths:
                paths.remove(utils_path)

            new_path = ';'.join(paths)
            winreg.SetValueEx(key, 'Path', 0, winreg.REG_EXPAND_SZ, new_path)
            
            # Notify Windows of environment change
            self.notify_env_update()
            return True
        except Exception as e:
            print(f"PATH operation failed: {e}")
            return False

    def notify_env_update(self):
        """Notify Windows of environment variable changes"""
        try:
            import ctypes
            HWND_BROADCAST = 0xFFFF
            WM_SETTINGCHANGE = 0x1A
            SMTO_ABORTIFHUNG = 0x0002
            result = ctypes.c_long()
            SendMessageTimeout = ctypes.windll.user32.SendMessageTimeoutW
            SendMessageTimeout(
                HWND_BROADCAST,
                WM_SETTINGCHANGE,
                0,
                'Environment',
                SMTO_ABORTIFHUNG,
                1000,
                ctypes.byref(result)
            )
        except Exception as e:
            print(f"Failed to notify environment update: {e}")

def main():
    updater = UpdateManager()
    updater.check_admin()

    if len(sys.argv) == 1 or (len(sys.argv) == 2 and sys.argv[1] == 'update'):
        updater.handle_update_process()
    elif len(sys.argv) == 2 and sys.argv[1] in {'add', 'remove'}:
        updater.handle_path_operation(sys.argv[1])

if __name__ == '__main__':
    main() 