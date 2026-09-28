// Lets the Android release build succeed from a normal Windows path.
//
// The C++ build of react-native-gesture-handler (pulled in by expo-router)
// produces object files whose paths pass 260 characters, and the ninja that
// ships with the Android SDK's CMake 3.22 cannot open longer paths even with
// Windows long path support turned on. CMake already shortens long object
// paths with an md5 hash, but its Windows budget of 250 characters leaves no
// room for that library's long file names, so it gives up and keeps them.
//
// CMake counts the object directory with a trailing "./", two characters
// more than the real path. A budget of 258 is the smallest that lets it hash
// the gesture-handler objects; real object paths then stay at 256 characters
// or less, and the `.d` files ninja reads at 258, under the 260 limit. It
// works for checkouts up to 35 characters deep, such as
// C:\Users\<name>\dev\llmsearch-mobile. On macOS and Linux the setting only
// changes some object file names.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// with-cmake-object-path-max';
const SNIPPET = `
${MARKER}
android {
    defaultConfig {
        externalNativeBuild {
            cmake {
                arguments "-DCMAKE_OBJECT_PATH_MAX=258"
            }
        }
    }
}
`;

module.exports = function withCmakeObjectPathMax(config) {
  return withAppBuildGradle(config, (mod) => {
    if (!mod.modResults.contents.includes(MARKER)) {
      mod.modResults.contents += SNIPPET;
    }
    return mod;
  });
};
