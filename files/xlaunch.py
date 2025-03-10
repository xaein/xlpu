#!/usr/bin/env python3
# xLauncher Plus Application Launcher
# Main source file

import os
import sys
import json
import logging
from datetime import datetime
import ctypes
from ctypes import wintypes
import win32com.shell.shell as shell # type: ignore
import win32security # type: ignore
import win32con # type: ignore
import win32api # type: ignore
import subprocess
from typing import Optional

class XLauncher:
    def __init__(self):
        self.base_directory = os.path.dirname(os.path.abspath(sys.executable))
        self.config_file = os.path.join(self.base_directory, "xlaunch.cfg")
        self.log_file = os.path.join(self.base_directory, "xlauncher.log")
        self.apps_list = os.path.join(self.base_directory, "xlauncher.xlfc")
        
        # Configuration defaults
        self.max_log_entries = 1000
        self.date_format = "dd-MM-yy"
        self.time_format = "HH:mm:ss"
        self.date_construct = "dateFormat timeFormat"
        self.encapsule_l = "["
        self.encapsule_r = "]"
        self.message_sep = ">>"
        self.message_note = "Launching:"

    def load_configuration(self):
        """Load configuration from xlaunch.cfg or create with defaults if not exists"""
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    for line in f:
                        if '=' in line:
                            key, value = line.strip().split('=', 1)
                            value = value.strip().strip("'\"")
                            if key == "maxLogEntries":
                                self.max_log_entries = int(value)
                            elif key == "dateFormat":
                                self.date_format = value
                            elif key == "timeFormat":
                                self.time_format = value
                            elif key == "construct":
                                self.date_construct = value
                            elif key == "leftEncapsule":
                                self.encapsule_l = value
                            elif key == "rightEncapsule":
                                self.encapsule_r = value
                            elif key == "messageSeperator":
                                self.message_sep = value
                            elif key == "messagePrefix":
                                self.message_note = value
            except:
                pass  # Use defaults if config read fails

    def write_to_log(self, message: str):
        """Write a log entry to the log file"""
        try:
            # Format the datetime string
            now = datetime.now()
            date_str = now.strftime("%d-%m-%y")
            time_str = now.strftime("%H:%M:%S")
            formatted_datetime = self.date_construct.replace("dateFormat", date_str).replace("timeFormat", time_str)
            
            # Create the log entry
            log_entry = f"{self.encapsule_l}{formatted_datetime}{self.encapsule_r} {self.message_sep} {message}"
            
            # Read existing logs or create empty list
            log_entries = []
            if os.path.exists(self.log_file):
                with open(self.log_file, 'r', encoding='utf-8') as f:
                    log_entries = f.readlines()
            
            # Add new entry and trim if needed
            log_entries.append(log_entry + '\n')
            if len(log_entries) > self.max_log_entries:
                log_entries = log_entries[-self.max_log_entries:]
            
            # Write back to file
            with open(self.log_file, 'w', encoding='utf-8') as f:
                f.writelines(log_entries)
        except:
            pass  # Silently fail if logging fails

    def launch_as_user(self, command: str, working_dir: Optional[str] = None) -> bool:
        """Attempt to launch process as normal user"""
        try:
            # Try simple os.startfile first (good for URLs and registered protocols)
            os.startfile(command)
            return True
        except:
            try:
                # Fall back to subprocess if startfile fails
                startupinfo = subprocess.STARTUPINFO()
                startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                subprocess.Popen(command, cwd=working_dir, startupinfo=startupinfo, shell=True)
                return True
            except:
                return False

    def launch_as_admin(self, command: str, working_dir: Optional[str] = None) -> bool:
        """Attempt to launch process with admin privileges"""
        try:
            params = f'/c start "" "{command}"'
            rc = shell.ShellExecuteEx(
                lpVerb='runas',
                lpFile='cmd.exe',
                lpParameters=params,
                lpDirectory=working_dir,
                nShow=win32con.SW_SHOWNORMAL
            )
            return bool(rc["hInstApp"] > 32)
        except:
            return False

    def process_app(self, app_name: str):
        """Process the application launch based on the provided app name"""
        if not app_name:
            return

        try:
            with open(self.apps_list, 'r', encoding='utf-8') as f:
                app_dictionary = json.load(f)

            if app_name in app_dictionary:
                launch_command = app_dictionary[app_name]
                launched = False

                # Set working directory (null for URLs, actual directory for files)
                working_dir = None if "://" in launch_command else (
                    os.path.dirname(launch_command) if os.path.isfile(launch_command) else None
                )

                # Try user first for all commands
                launched = self.launch_as_user(launch_command, working_dir)
                
                # If user launch fails, try admin
                if not launched:
                    launched = self.launch_as_admin(launch_command, working_dir)

                # Log only once after all launch attempts
                if launched:
                    self.write_to_log(f"{self.message_note} {app_name}")
                else:
                    self.write_to_log(f"Error: Failed to launch {app_name}")
            else:
                self.write_to_log(f"Error: {app_name} was not found in the app list.")
        except:
            pass  # Silently fail on any other errors

def main():
    if len(sys.argv) < 2:
        sys.exit(0)
        
    launcher = XLauncher()
    launcher.load_configuration()
    app_name = " ".join(sys.argv[1:])
    launcher.process_app(app_name)

if __name__ == "__main__":
    main() 