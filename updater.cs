using System;
using System.IO;
using System.Linq;
using Newtonsoft.Json.Linq;

class Program
{
    static void Main(string[] args)
    {
        string sourceDir = @"f:\coding\xlauncherplus";
        string destDir = @"f:\coding\xlpu\files";
        string versionJsonPath = @"f:\coding\xlpu\version.json";
        string updateComment = "No comment provided";

        // Check for the -c flag and concatenate all following arguments as the comment
        int commentIndex = Array.IndexOf(args, "-c");
        if (commentIndex != -1 && commentIndex + 1 < args.Length)
        {
            updateComment = string.Join(" ", args.Skip(commentIndex + 1));
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
                ["mainFiles"] = new JObject()
            };
        }

        // Create new JSON objects to track changes
        var newFilesSection = new JObject();
        var newMainFilesSection = new JObject();

        Console.WriteLine("");
        Console.WriteLine("Starting update process...");
        Console.WriteLine("");

        // Process files and directories
        bool filesChanged = ProcessDirectory(sourceDir, destDir, versionJson, newFilesSection, newMainFilesSection, true, sourceDir);

        // Increment the version number if files were changed
        if (filesChanged)
        {
            IncrementVersion(versionJson);
        }

        // Update the version and add the comment
        versionJson["comment"] = updateComment;
        versionJson["files"] = newFilesSection;
        versionJson["mainFiles"] = newMainFilesSection;

        // Write the updated version information back to the file
        File.WriteAllText(versionJsonPath, versionJson.ToString());

        Console.WriteLine("Updated version to: " + versionJson["version"]);
        Console.WriteLine("Included comment: " + updateComment);
        Console.WriteLine("");
        Console.WriteLine("Update process completed.");
        Console.WriteLine("");
    }

    static bool ProcessDirectory(string srcFolder, string destFolder, JObject versionJson, JObject newFilesSection, JObject newMainFilesSection, bool isBaseFolder, string rootSourceDir)
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
                string destFilePath = Path.Combine(destFolder, fileName); // Copy all files directly into destFolder
                if (!File.Exists(destFilePath) || !FilesAreEqual(srcFile, destFilePath))
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
                filesChanged |= ProcessDirectory(srcSubFolder, destFolder, versionJson, newFilesSection, newMainFilesSection, false, rootSourceDir);
            }
        }

        return filesChanged;
    }

    static void IncrementVersion(JObject versionJson)
    {
        string version = versionJson["version"]?.ToString() ?? "1.0.0";
        var versionParts = version.Split(new char[] { '.' });

        int major = int.Parse(versionParts[0]);
        int minor = int.Parse(versionParts[1]);
        int patch = int.Parse(versionParts[2]);

        patch++;
        if (patch >= 10)
        {
            patch = 0;
            minor++;
        }

        versionJson["version"] = $"{major}.{minor}.{patch}";
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
}