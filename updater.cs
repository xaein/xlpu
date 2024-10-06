using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using System.Diagnostics;
using System.IO.Compression;

class Program
{
    // Main entry point
    // Handles the update process for xLauncher Plus
    static void Main(string[] args)
    {
        if (args.Length == 0)
        {
            DisplayHelp();
            return;
        }

        // Define source and destination directories, and other variables
        string sourceDir = @"f:\coding\xlauncherplus";
        string destDir = @"f:\coding\xlpu\files";
        string versionJsonPath = @"f:\coding\xlpu\version.json";
        string updateComment = "No comment provided";

        // Check for command line arguments
        bool forceFullUpdate = args.Contains("-f");
        bool updateNodeModules = args.Contains("-n");
        bool updateHelpFiles = args.Contains("-h");

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

        // Read the existing version information
        JObject versionJson;
        string currentVersion = "1.0.0";
        if (File.Exists(versionJsonPath))
        {
            versionJson = JObject.Parse(File.ReadAllText(versionJsonPath));
            currentVersion = versionJson["version"]?.ToString() ?? currentVersion;
        }
        else
        {
            versionJson = new JObject
            {
                ["version"] = currentVersion,
                ["comment"] = updateComment,
                ["files"] = new JObject(),
                ["mainFiles"] = new JObject(),
                ["directoryZips"] = new JObject(),
                ["lastFullUpdate"] = true,
                ["dependencies"] = new JObject()
            };
            forceFullUpdate = true;
        }

        // Initialize flags for update process
        bool isFullUpdate = forceFullUpdate;
        bool fullUpdateExcludingMain = false;
        bool minorIncremented = false;

        // Create new JSON objects to track changes
        var newFilesSection = new JObject();
        var newMainFilesSection = new JObject();
        var directoryZips = new JObject();

        // Display update process start message
        Console.WriteLine();
        Console.WriteLine("Starting update process...");
        Console.WriteLine();

        // Process files and directories
        bool filesChanged = ProcessDirectory(sourceDir, destDir, versionJson, newFilesSection, newMainFilesSection, true, sourceDir, forceFullUpdate);

        // Create zip files for dependencies if requested
        if (updateNodeModules)
        {
            CreateDependencyZips(sourceDir, destDir, versionJson, directoryZips);
        }

        if (updateHelpFiles)
        {
            CreateHelpZip(sourceDir, destDir, directoryZips);
        }

        // Increment version if needed
        if (filesChanged || forceFullUpdate)
        {
            minorIncremented = IncrementVersion(versionJson, out fullUpdateExcludingMain);
            if (minorIncremented || forceFullUpdate)
            {
                Console.WriteLine(forceFullUpdate ? "Forced full update." : "Minor version incremented. Performing full update...");
                newFilesSection.RemoveAll();
                newMainFilesSection.RemoveAll();
                ProcessDirectory(sourceDir, destDir, versionJson, newFilesSection, newMainFilesSection, true, sourceDir, true);
                versionJson["lastFullUpdate"] = true;
                isFullUpdate = true;
            }
            else if (fullUpdateExcludingMain)
            {
                Console.WriteLine("Patch 10% update. Performing full update excluding main files...");
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
            UpdateMainFileEntries(versionJson["mainFiles"] as JObject, newMainFilesSection);
            UpdateDirectoryZips(versionJson["directoryZips"] as JObject, directoryZips);
        }
        else
        {
            versionJson["files"] = newFilesSection;
            if (forceFullUpdate || minorIncremented)
            {
                versionJson["mainFiles"] = newMainFilesSection;
            }
            else
            {
                UpdateMainFileEntries(versionJson["mainFiles"] as JObject, newMainFilesSection);
            }
        }

        // Update the directoryZips section
        if (directoryZips.Count > 0)
        {
            versionJson["directoryZips"] = directoryZips;
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
            ["directoryZips"] = versionJson["directoryZips"],
            ["lastFullUpdate"] = versionJson["lastFullUpdate"],
            ["dependencies"] = versionJson["dependencies"]
        };

        // Write the updated version information back to the file
        File.WriteAllText(versionJsonPath, orderedVersionJson.ToString());

        Console.WriteLine("Updated version to: " + versionJson["version"]);
        Console.WriteLine("Included comment:");
        Console.WriteLine(updateComment);
        Console.WriteLine();
        Console.WriteLine("Update process completed.");

        // Add GitHub update after the update process
        UpdateGitHub(versionJson["version"].ToString());
    }

    // Display help information
    // Shows usage instructions and available options for the updater
    static void DisplayHelp()
    {
        Console.WriteLine("XLauncher Plus Updater");
        Console.WriteLine("Usage: updater.exe [options]");
        Console.WriteLine();
        Console.WriteLine("Options:");
        Console.WriteLine("  -f              Force a full update, copying all files");
        Console.WriteLine("  -n              Update node_modules (create zip files for dependencies)");
        Console.WriteLine("  -h              Update help files (create zip file for help directory)");
        Console.WriteLine("  -c <comment>    Add a comment to the version.json file");
        Console.WriteLine("                  Use '|' to separate lines in the comment");
        Console.WriteLine("                  For best results, use \" \" around the comment");
        Console.WriteLine();
        Console.WriteLine("Note: The -c option should always be the last option if used.");
        Console.WriteLine();
        Console.WriteLine("Examples:");
        Console.WriteLine("  updater.exe -f -c \"Forced full update with new features\"");
        Console.WriteLine("  updater.exe -n -h -c \"Updated dependencies and help files\"");
        Console.WriteLine("  updater.exe -c \"Minor update|Fixed bug #123|Added new feature\"");
    }

    // Process directory for updates
    // Recursively processes files and directories, updating the version information
    static bool ProcessDirectory(string srcFolder, string destFolder, JObject versionJson, JObject newFilesSection, JObject newMainFilesSection, bool isBaseFolder, string rootSourceDir, bool forceFullUpdate)
    {
        bool filesChanged = false;

        // Loop through each file in the source folder
        foreach (var srcFile in Directory.GetFiles(srcFolder))
        {
            string fileName = Path.GetFileName(srcFile);
            if ((isBaseFolder && (fileName.StartsWith("xlauncher", StringComparison.OrdinalIgnoreCase) && (fileName.EndsWith(".js", StringComparison.OrdinalIgnoreCase) || fileName.EndsWith(".html", StringComparison.OrdinalIgnoreCase) || fileName.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)))) ||
                (!isBaseFolder && (fileName.EndsWith(".js", StringComparison.OrdinalIgnoreCase) || fileName.EndsWith(".html", StringComparison.OrdinalIgnoreCase) || fileName.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) || fileName.EndsWith(".scss", StringComparison.OrdinalIgnoreCase))))
            {
                string relativePath = GetRelativePath(rootSourceDir, srcFile);
                string destFilePath = Path.Combine(destFolder, fileName);
                if (forceFullUpdate || !File.Exists(destFilePath) || !FilesAreEqual(srcFile, destFilePath))
                {
                    File.Copy(srcFile, destFilePath, true);

                    // Add the file to the appropriate section in the new JSON
                    if (fileName.StartsWith("xlauncher", StringComparison.OrdinalIgnoreCase))
                    {
                        newMainFilesSection[fileName] = 0;
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

    // Increment version number
    // Updates the version in the version.json file
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

    // Get relative path
    // Returns the relative path from the base directory to the file
    static string GetRelativePath(string baseDir, string filePath)
    {
        Uri baseUri = new Uri(baseDir + Path.DirectorySeparatorChar);
        Uri fileUri = new Uri(filePath);
        return Uri.UnescapeDataString(baseUri.MakeRelativeUri(fileUri).ToString().Replace('/', Path.DirectorySeparatorChar));
    }

    // Compare two files
    // Returns true if the files are identical, false otherwise
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

    // Update GitHub
    // Pushes the update to the GitHub repository
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

    // Run Git command
    // Executes a Git command in the specified working directory
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

    // Merge file entries
    // Merges the new file entries into the existing file entries
    static void MergeFileEntries(JObject existingFiles, JObject newFiles)
    {
        foreach (var file in newFiles)
        {
            existingFiles[file.Key] = file.Value;
        }
    }

    // Create dependency zip files
    // Creates zip files for updated dependencies
    static void CreateDependencyZips(string sourceDir, string destDir, JObject versionJson, JObject directoryZips)
    {
        string nodeModulesDir = Path.Combine(sourceDir, "node_modules");
        string packageJsonPath = Path.Combine(sourceDir, "package.json");

        if (!Directory.Exists(nodeModulesDir))
        {
            Console.WriteLine("node_modules directory not found.");
            return;
        }

        if (!File.Exists(packageJsonPath))
        {
            Console.WriteLine("package.json not found.");
            return;
        }

        JObject packageJson = JObject.Parse(File.ReadAllText(packageJsonPath));
        var currentDependencies = packageJson["dependencies"] as JObject;

        if (currentDependencies == null)
        {
            Console.WriteLine("No dependencies found in package.json.");
            return;
        }

        var oldDependencies = versionJson["dependencies"] as JObject ?? new JObject();
        var changedDependencies = new List<string>();

        foreach (var dep in currentDependencies)
        {
            string depName = dep.Key;
            string currentVersion = dep.Value.ToString().TrimStart('^', '~', 'v');
            string oldVersion = oldDependencies[depName]?.ToString();

            if (oldVersion != currentVersion)
            {
                changedDependencies.Add(depName);
                Console.WriteLine($"Dependency {depName} changed from {oldVersion} to {currentVersion}");
            }
        }

        if (changedDependencies.Count > 0)
        {
            string zipName = "node_modules.zip";
            string zipPath = Path.Combine(destDir, zipName);
            
            using (FileStream zipToOpen = new FileStream(zipPath, FileMode.Create))
            using (ZipArchive archive = new ZipArchive(zipToOpen, ZipArchiveMode.Create))
            {
                foreach (var depName in changedDependencies)
                {
                    var dirPath = Path.Combine(nodeModulesDir, depName);
                    if (Directory.Exists(dirPath))
                    {
                        AddDirectoryToZip(archive, dirPath, Path.Combine("node_modules", depName));
                    }
                }
            }

            directoryZips[zipName] = true;
            Console.WriteLine($"Created zip for node_modules with {changedDependencies.Count} updated dependencies");

            versionJson["dependencies"] = currentDependencies;
        }
        else
        {
            Console.WriteLine("No changes in dependencies, skipping node_modules zip creation.");
        }
    }

    // Add directory to zip
    // Adds the specified directory to the zip archive
    static void AddDirectoryToZip(ZipArchive archive, string sourceDir, string entryName)
    {
        foreach (string filePath in Directory.GetFiles(sourceDir, "*", SearchOption.AllDirectories))
        {
            string relativePath = filePath.Substring(sourceDir.Length).TrimStart(Path.DirectorySeparatorChar);
            string zipEntryName = Path.Combine(entryName, relativePath);
            
            using (Stream fileStream = File.OpenRead(filePath))
            using (Stream zipEntryStream = archive.CreateEntry(zipEntryName).Open())
            {
                fileStream.CopyTo(zipEntryStream);
            }
        }
    }

    // Create help zip file
    // Creates a zip file for the help directory
    static void CreateHelpZip(string sourceDir, string destDir, JObject directoryZips)
    {
        string helpDir = Path.Combine(sourceDir, "help");
        if (!Directory.Exists(helpDir))
        {
            Console.WriteLine("help directory not found.");
            return;
        }

        string zipName = "help.zip";
        string zipPath = Path.Combine(destDir, zipName);
        
        using (FileStream zipToOpen = new FileStream(zipPath, FileMode.Create))
        using (ZipArchive archive = new ZipArchive(zipToOpen, ZipArchiveMode.Create))
        {
            AddDirectoryToZip(archive, helpDir, "");
        }

        directoryZips[zipName] = true;
        Console.WriteLine("Created zip for help files");
    }

    // Update main file entries
    // Updates the main file entries in the version.json file
    static void UpdateMainFileEntries(JObject existingFiles, JObject newFiles)
    {
        var filesToRemove = new List<string>();

        foreach (var file in existingFiles)
        {
            if (newFiles.Properties().Any(p => p.Name == file.Key))
            {
                existingFiles[file.Key] = 0;
            }
            else
            {
                int count = (int)file.Value + 1;
                if (count > 2)
                {
                    filesToRemove.Add(file.Key);
                }
                else
                {
                    existingFiles[file.Key] = count;
                }
            }
        }

        foreach (var file in newFiles.Properties())
        {
            existingFiles[file.Name] = 0;
        }

        foreach (var file in filesToRemove)
        {
            existingFiles.Remove(file);
        }
    }

    // Update directory zip entries
    // Updates the directory zip entries in the version.json file
    static void UpdateDirectoryZips(JObject existingZips, JObject newZips)
    {
        var zipsToRemove = new List<string>();

        foreach (var zip in existingZips)
        {
            if (newZips.Properties().Any(p => p.Name == zip.Key))
            {
                existingZips[zip.Key] = 0;  // Reset counter for updated zips
            }
            else
            {
                int count = (int)zip.Value + 1;
                if (count > 2)
                {
                    zipsToRemove.Add(zip.Key);
                }
                else
                {
                    existingZips[zip.Key] = count;
                }
            }
        }

        foreach (var zip in newZips.Properties())
        {
            existingZips[zip.Name] = 0;  // Add new zips with counter 0
        }

        foreach (var zip in zipsToRemove)
        {
            existingZips.Remove(zip);
        }
    }
}