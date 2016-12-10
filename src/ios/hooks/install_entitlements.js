// using error to see if this shows up in AB
console.error("Running hook to add HealthKit flag in the Capabilities to iOS and add entitlements");

var xcode = require('xcode'),
    fs = require('fs'),
    path = require('path'),
    plist = require('plist'),
    util = require('util');

module.exports = function (context) {
  var Q = context.requireCordovaModule('q');
  var deferral = new Q.defer();

  if (context.opts.cordova.platforms.indexOf('ios') < 0) {
    throw new Error('This plugin expects the ios platform to exist.');
  }

  var iosFolder = context.opts.cordova.project ? context.opts.cordova.project.root : path.join(context.opts.projectRoot, 'platforms/ios/');
  console.log("iosFolder: " + iosFolder);

  fs.readdir(iosFolder, function (err, data) {
    if (err) {
      throw err;
    }

    var projFolder;
    var projName;

    // Find the project folder by looking for *.xcodeproj
    if (data && data.length) {
      data.forEach(function (folder) {
        if (folder.match(/\.xcodeproj$/)) {
          projFolder = path.join(iosFolder, folder);
          projName = path.basename(folder, '.xcodeproj');
        }
      });
    }

    if (!projFolder || !projName) {
      throw new Error("Could not find an .xcodeproj folder in: " + iosFolder);
    }

    var destFile = path.join(iosFolder, projName, projName + '.entitlements');
    if (fs.existsSync(destFile)) {
      console.error("File exists, not doing anything: " + destFile);

      var obj = plist.parse(fs.readFileSync(destFile, 'utf8'));
      console.log(JSON.stringify(obj));

      obj['com.apple.developer.healthkit'] = true;
      var xml = plist.build(obj);
      fs.writeFileSync(destFile, xml, { encoding: 'utf8' });


    } else {
      destFile = path.join(iosFolder, projName, 'Resources', projName + '.entitlements');
      console.log("Will add iOS HealthKit entitlements to project '" + projName + "'");

      //var projectPlistPath = path.join(context.opts.projectRoot, 'platforms/ios', projName, util.format('%s-Info.plist', projName));
      var projectPlistPath = path.join(iosFolder, projName, util.format('%s-Info.plist', projName));
      var projectPlistJson = plist.parse(fs.readFileSync(projectPlistPath, 'utf8'));
      var sharedBundleID = projectPlistJson.KeychainSharingBundleID;
      console.log("HealthKit passed in as variable: " + sharedBundleID);


      // create a new entitlements plist file
      //var sourceFile = 'plugins/cordova-plugin-keychainsharing/src/ios/resources/KeychainSharing.entitlements';
      var sourceFile = path.join(context.opts.plugin.pluginInfo.dir, 'src/ios/Resources/OutSystems.entitlements');
      fs.readFile(sourceFile, 'utf8', function (err, data) {
        //data = data.replace(/__KEYCHAIN_ACCESS_GROUP__/g, sharedBundleID);

        fs.writeFileSync(destFile, data);

        var projectPath = path.join(projFolder, 'project.pbxproj');

        var pbxProject;
        if (context.opts.cordova.project) {
          pbxProject = context.opts.cordova.project.parseProjectFile(context.opts.projectRoot).xcode;
        } else {
          pbxProject = xcode.project(projectPath);
          pbxProject.parseSync();
        }

        pbxProject.addResourceFile(projName + ".entitlements");

        var configGroups = pbxProject.hash.project.objects['XCBuildConfiguration'];
        for (var key in configGroups) {
          var config = configGroups[key];
          if (config.buildSettings !== undefined) {
            //config.buildSettings.CODE_SIGN_ENTITLEMENTS = '"' + projName + '/' + projName + '.entitlements"';
            config.buildSettings.CODE_SIGN_ENTITLEMENTS = '"' + projName + '/Resources/' + projName + '.entitlements"';
            //console.log("Adding iOS Keychain Sharing entitlements to project '" + projName + "'");
          }
        }

        // write the updated project file
        fs.writeFileSync(projectPath, pbxProject.writeSync());
        console.warn("OK, added iOS HealthKit entitlements to project '" + projName + "'");

        deferral.resolve();
      });
    }
  });

  return deferral.promise;
};
