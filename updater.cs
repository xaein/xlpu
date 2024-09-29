using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using System.Diagnostics;

class Program
{
    static void Main(string[] args)
    {
        if (args.Length == 0)
        {
            DisplayHelp();
            return;
        }

        string sourceDir = @"f:\coding\xlauncherplus";
        string destDir = @"f:\coding\xlpu\files";
        string versionJsonPath = @"f:\coding\xlpu\version.json";
        string updateComment = "No comment provided";
        List<string> gitCommitLines = new List<string>();

        // Check for the -c flag and concatenate all following arguments as the comment
        int commentIndex = Array.IndexOf(args, "-c");
        if (commentIndex != -1 && commentIndex + 1 < args.Length)
        {
            updateComment = string.Join(" ", args.Skip(commentIndex + 1));
            
            // Replace literal "\n", " | ", and "|" with actual newline characters
            updateComment = updateComment.Replace("\\n", "\n").Replace(" | ", "\n").Replace("|", "\n");
        }

        // Ensure the destination directory exists
        if (!Directory.Exists(destDir))
        {
            Directory.CreateDirectory(destDir);
        }

        bool forceFullUpdate = args.Contains("-f");
        bool isFullUpdate = forceFullUpdate;
        bool fullUpdateExcludingMain = false;
        bool minorIncremented = false;

        // Read the existing version information
        JObject versionJson;
        string currentVersion = "1.0.0";
        if (File.Exists(versionJsonPath))
        {
            versionJson = JObject.Parse(File.ReadAllText(versionJsonPath));
            currentVersion = versionJson["version"]?.ToString() ?? currentVersion;

            // Convert mainFiles from JArray to JObject if necessary
            if (versionJson["mainFiles"] is JArray mainFilesArray)
            {
                var mainFilesObject = new JObject();
                foreach (var file in mainFilesArray)
                {
                    mainFilesObject[file.ToString()] = true;
                }
                versionJson["mainFiles"] = mainFilesObject;
            }
        }
        else
        {
            versionJson = new JObject
            {
                ["version"] = currentVersion,
                ["comment"] = updateComment,
                ["files"] = new JObject(),
                ["mainFiles"] = new JObject(),
                ["lastFullUpdate"] = true
            };
            isFullUpdate = true;
        }

        // Create new JSON objects to track changes
        var newFilesSection = new JObject();
        var newMainFilesSection = new JObject();

        Console.WriteLine("");
        Console.WriteLine("Starting update process...");
        Console.WriteLine("");

        // Process files and directories
        bool filesChanged = ProcessDirectory(sourceDir, destDir, versionJson, newFilesSection, newMainFilesSection, true, sourceDir, forceFullUpdate);

        if (filesChanged || forceFullUpdate)
        {
            minorIncremented = IncrementVersion(versionJson, out fullUpdateExcludingMain);
            if (minorIncremented || forceFullUpdate)
            {
                Console.WriteLine(forceFullUpdate ? "Forced full update." : "Minor version incremented. Performing full update...");
                // Perform a full copy as if the directory was empty
                newFilesSection.RemoveAll();
                newMainFilesSection.RemoveAll();
                ProcessDirectory(sourceDir, destDir, versionJson, newFilesSection, newMainFilesSection, true, sourceDir, true);
                versionJson["lastFullUpdate"] = true;
                isFullUpdate = true;
            }
            else if (fullUpdateExcludingMain)
            {
                Console.WriteLine("Patch 10% update. Performing full update excluding main files...");
                // Perform a full copy excluding main files
                newFilesSection.RemoveAll();
                ProcessDirectory(sourceDir, destDir, versionJson, newFilesSection, newMainFilesSection, false, sourceDir, true);
                versionJson["lastFullUpdate"] = false; 
                isFullUpdate = true;
            }
            else
            {
                versionJson["lastFullUpdate"] = false;
            }
        }

        // Merge new files with existing files if it's not a full update
        if (!(bool)versionJson["lastFullUpdate"])
        {
            MergeFileEntries(versionJson["files"] as JObject, newFilesSection);
            MergeFileEntries(versionJson["mainFiles"] as JObject, newMainFilesSection);
        }
        else
        {
            versionJson["files"] = newFilesSection;
            if (forceFullUpdate || minorIncremented)
            {
                versionJson["mainFiles"] = newMainFilesSection;
            }
        }

        // Update the version and add the comment
        if (isFullUpdate)
        {
            updateComment = "Full Update\n" + updateComment;
        }
        versionJson["comment"] = updateComment;

        // Create a new JObject with the desired property order
        var orderedVersionJson = new JObject
        {
            ["version"] = versionJson["version"],
            ["comment"] = versionJson["comment"],
            ["files"] = versionJson["files"],
            ["mainFiles"] = versionJson["mainFiles"],
            ["lastFullUpdate"] = versionJson["lastFullUpdate"]
        };

        // Write the updated version information back to the file
        File.WriteAllText(versionJsonPath, orderedVersionJson.ToString());

        Console.WriteLine("Updated version to: " + versionJson["version"]);
        Console.WriteLine("Included comment:");
        Console.WriteLine(updateComment);
        Console.WriteLine("");
        Console.WriteLine("Update process completed.");

        // Add GitHub update after the update process
        UpdateGitHub(versionJson["version"].ToString());
    }

    static void DisplayHelp()
    {
        Console.WriteLine("XLauncher Plus Updater");
        Console.WriteLine("Usage: updater.exe [options]");
        Console.WriteLine();
        Console.WriteLine("Options:");
        Console.WriteLine("  -f              Force a full update, copying all files");
        Console.WriteLine("  -c <comment>    Add a comment to the version.json file");
        Console.WriteLine("                  Use '|' to separate lines in the comment");
        Console.WriteLine("                  For best results, use \" \" around the comment");
        Console.WriteLine();
        Console.WriteLine("Examples:");
        Console.WriteLine("  updater.exe -c \"Updated UI components\"");
        Console.WriteLine("  updater.exe -c \"Line 1 | Line 2 | Line 3\"");
        Console.WriteLine("  updater.exe -f -c \"Major update|Fixed bug #123|Added new feature\"");
    }

    static bool ProcessDirectory(string srcFolder, string destFolder, JObject versionJson, JObject newFilesSection, JObject newMainFilesSection, bool isBaseFolder, string rootSourceDir, bool forceFullUpdate)
    {
        bool filesChanged = false;

        // Loop through each file in the source folder
        foreach (var srcFile in Directory.GetFiles(srcFolder))
        {
            string fileName = Path.GetFileName(srcFile);
            if ((isBaseFolder && (fileName.StartsWith("xlauncher", StringComparison.OrdinalIgnoreCase) && (fileName.EndsWith(".js", StringComparison.OrdinalIgnoreCase) || fileName.EndsWith(".html", StringComparison.OrdinalIgnoreCase) || fileName.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)))) ||
                (!isBaseFolder && (fileName.EndsWith(".js", StringComparison.OrdinalIgnoreCase) || fileName.EndsWith(".html", StringComparison.OrdinalIgnoreCase) || fileName.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))))
            {
                string relativePath = GetRelativePath(rootSourceDir, srcFile);
                string destFilePath = Path.Combine(destFolder, fileName);
                if (forceFullUpdate || !File.Exists(destFilePath) || !FilesAreEqual(srcFile, destFilePath))
                {
                    File.Copy(srcFile, destFilePath, true);

                    // Add the file to the appropriate section in the new JSON
                    if (fileName.StartsWith("xlauncher", StringComparison.OrdinalIgnoreCase))
                    {
                        newMainFilesSection[fileName] = true;
                    }
                    else
                    {
                        string directory = Path.GetDirectoryName(relativePath).Replace("\\", "/");
                        newFilesSection[fileName] = directory;
                    }
                    filesChanged = true;
                }
            }
        }

        // Loop through each subfolder in the source folder
        foreach (var srcSubFolder in Directory.GetDirectories(srcFolder))
        {
            string folderName = Path.GetFileName(srcSubFolder);
            if (!folderName.Equals("node_modules", StringComparison.OrdinalIgnoreCase) &&
                !folderName.Equals("dist", StringComparison.OrdinalIgnoreCase) &&
                !folderName.Equals("help", StringComparison.OrdinalIgnoreCase))
            {
                filesChanged |= ProcessDirectory(srcSubFolder, destFolder, versionJson, newFilesSection, newMainFilesSection, false, rootSourceDir, forceFullUpdate);
            }
        }

        return filesChanged;
    }

    static bool IncrementVersion(JObject versionJson, out bool fullUpdateExcludingMain)
    {
        string version = versionJson["version"]?.ToString() ?? "1.0.0";
        var versionParts = version.Split(new char[] { '.' });

        int major = int.Parse(versionParts[0]);
        int minor = int.Parse(versionParts[1]);
        int patch = int.Parse(versionParts[2]);

        bool minorIncremented = false;
        fullUpdateExcludingMain = false;

        patch++;
        if (patch > 99)
        {
            patch = 0;
            minor++;
            minorIncremented = true;
        }
        else if (patch % 10 == 0)
        {
            fullUpdateExcludingMain = true;
        }

        versionJson["version"] = $"{major}.{minor}.{patch}";
        return minorIncremented;
    }

    static string GetRelativePath(string baseDir, string filePath)
    {
        Uri baseUri = new Uri(baseDir + Path.DirectorySeparatorChar);
        Uri fileUri = new Uri(filePath);
        return Uri.UnescapeDataString(baseUri.MakeRelativeUri(fileUri).ToString().Replace('/', Path.DirectorySeparatorChar));
    }

    static bool FilesAreEqual(string filePath1, string filePath2)
    {
        byte[] file1 = File.ReadAllBytes(filePath1);
        byte[] file2 = File.ReadAllBytes(filePath2);

        if (file1.Length != file2.Length)
            return false;

        for (int i = 0; i < file1.Length; i++)
        {
            if (file1[i] != file2[i])
                return false;
        }

        return true;
    }

    static void UpdateGitHub(string version)
    {
        string repoPath = @"f:\coding\xlpu";

        try
        {
            // Configure Git to handle line endings automatically
            RunGitCommand(repoPath, "config core.autocrlf true");

            RunGitCommand(repoPath, "add .");
            
            // Prepare the commit message with just the version number
            string commitMessage = $"Update to version {version}";
            
            RunGitCommand(repoPath, $"commit -m \"{commitMessage}\"");
            RunGitCommand(repoPath, "push origin main");

            Console.WriteLine($"Successfully pushed update for version {version} to GitHub.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Failed to update GitHub: {ex.Message}");
        }
    }

    static void RunGitCommand(string workingDirectory, string arguments)
    {
        using (Process process = new Process())
        {
            process.StartInfo.FileName = "git";
            process.StartInfo.Arguments = arguments;
            process.StartInfo.WorkingDirectory = workingDirectory;
            process.StartInfo.UseShellExecute = false;
            process.StartInfo.RedirectStandardOutput = true;
            process.StartInfo.RedirectStandardError = true;
            process.Start();
            
            string output = process.StandardOutput.ReadToEnd();
            string error = process.StandardError.ReadToEnd();
            
            process.WaitForExit();
            
            // Combine output and error, as Git sometimes writes to stderr for non-error messages
            string fullOutput = output + error;
            
            // Filter out CRLF warnings and collect other messages
            string filteredOutput = "";
            int startIndex = 0;
            int endIndex;
            while ((endIndex = fullOutput.IndexOf('\n', startIndex)) != -1)
            {
                string line = fullOutput.Substring(startIndex, endIndex - startIndex).Trim();
                if (!string.IsNullOrEmpty(line) && !line.Contains("LF will be replaced by CRLF"))
                {
                    filteredOutput += line + "\n";
                }
                startIndex = endIndex + 1;
            }
            // Check the last line if it doesn't end with a newline
            if (startIndex < fullOutput.Length)
            {
                string lastLine = fullOutput.Substring(startIndex).Trim();
                if (!string.IsNullOrEmpty(lastLine) && !lastLine.Contains("LF will be replaced by CRLF"))
                {
                    filteredOutput += lastLine;
                }
            }
            
            // Check if the filtered output contains any error messages
            if (filteredOutput.Contains("error:") || filteredOutput.Contains("fatal:"))
            {
                throw new Exception($"Git command failed: {filteredOutput}");
            }
            
            Console.WriteLine(filteredOutput);
        }
    }

    static void MergeFileEntries(JObject existingFiles, JObject newFiles)
    {
        foreach (var file in newFiles)
        {
            existingFiles[file.Key] = file.Value;
        }
    }
}