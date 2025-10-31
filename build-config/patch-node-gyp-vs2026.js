/**
 * Patch node-gyp to support Visual Studio 2026 Insiders
 *
 * This script modifies @electron/node-gyp to recognize VS 2026 Insiders (Major Version 18)
 * and use the correct toolset (v145).
 *
 * Run this script after npm install to ensure native modules can be compiled.
 * Usage: node build-config/patch-node-gyp-vs2026.js
 */

const fs = require('fs')
const path = require('path')

const TARGET_FILE = path.join(__dirname, '../node_modules/@electron/node-gyp/lib/find-visualstudio.js')

console.log('🔧 Patching node-gyp for Visual Studio 2026 Insiders support...\n')

// Check if target file exists
if (!fs.existsSync(TARGET_FILE)) {
  console.error('❌ Error: Target file not found:', TARGET_FILE)
  console.error('   Please run npm install first.')
  process.exit(1)
}

// Read the file
let content = fs.readFileSync(TARGET_FILE, 'utf8')

// Track if any patches were applied
let patchCount = 0

/**
 * Patch 1: Add 2026 to findVisualStudio2019OrNewerFromSpecifiedLocation
 */
const patch1Old = 'return this.findVSFromSpecifiedLocation([2019, 2022])'
const patch1New = 'return this.findVSFromSpecifiedLocation([2019, 2022, 2026])'

if (content.includes(patch1New)) {
  console.log('✅ Patch 1: Already applied (findVSFromSpecifiedLocation)')
} else if (content.includes(patch1Old)) {
  content = content.replace(patch1Old, patch1New)
  patchCount++
  console.log('✅ Patch 1: Applied (findVSFromSpecifiedLocation)')
} else {
  console.log('⚠️  Patch 1: Pattern not found - may already be modified differently')
}

/**
 * Patch 2: Add 2026 to findVisualStudio2019OrNewerUsingSetupModule
 */
const patch2Old = 'return this.findNewVSUsingSetupModule([2019, 2022])'
const patch2New = 'return this.findNewVSUsingSetupModule([2019, 2022, 2026])'

if (content.includes(patch2New)) {
  console.log('✅ Patch 2: Already applied (findNewVSUsingSetupModule)')
} else if (content.includes(patch2Old)) {
  content = content.replace(patch2Old, patch2New)
  patchCount++
  console.log('✅ Patch 2: Applied (findNewVSUsingSetupModule)')
} else {
  console.log('⚠️  Patch 2: Pattern not found - may already be modified differently')
}

/**
 * Patch 3: Add 2026 to findVisualStudio2019OrNewer
 */
const patch3Old = 'return this.findNewVS([2019, 2022])'
const patch3New = 'return this.findNewVS([2019, 2022, 2026])'

if (content.includes(patch3New)) {
  console.log('✅ Patch 3: Already applied (findNewVS)')
} else if (content.includes(patch3Old)) {
  content = content.replace(patch3Old, patch3New)
  patchCount++
  console.log('✅ Patch 3: Applied (findNewVS)')
} else {
  console.log('⚠️  Patch 3: Pattern not found - may already be modified differently')
}

/**
 * Patch 4: Add version mapping (Major 18 → 2026)
 */
const patch4Pattern = /if \(ret\.versionMajor === 17\) \{\s*ret\.versionYear = 2022\s*return ret\s*\}/
const patch4Check = 'ret.versionYear = 2026'

if (content.includes(patch4Check)) {
  console.log('✅ Patch 4: Already applied (version mapping 18 → 2026)')
} else if (patch4Pattern.test(content)) {
  content = content.replace(
    patch4Pattern,
    `if (ret.versionMajor === 17) {
      ret.versionYear = 2022
      return ret
    }
    if (ret.versionMajor === 18) {
      ret.versionYear = 2026
      return ret
    }`
  )
  patchCount++
  console.log('✅ Patch 4: Applied (version mapping 18 → 2026)')
} else {
  console.log('⚠️  Patch 4: Pattern not found - may already be modified differently')
}

/**
 * Patch 5: Add toolset mapping (2026 → v145)
 */
const patch5Pattern = /} else if \(versionYear === 2022\) \{\s*return 'v143'\s*\}/
const patch5Check = "versionYear === 2026"

if (content.includes(patch5Check)) {
  console.log('✅ Patch 5: Already applied (toolset 2026 → v145)')
} else if (patch5Pattern.test(content)) {
  content = content.replace(
    patch5Pattern,
    `} else if (versionYear === 2022) {
      return 'v143'
    } else if (versionYear === 2026) {
      return 'v145'
    }`
  )
  patchCount++
  console.log('✅ Patch 5: Applied (toolset 2026 → v145)')
} else {
  console.log('⚠️  Patch 5: Pattern not found - may already be modified differently')
}

// Write the patched content back to file
if (patchCount > 0) {
  try {
    fs.writeFileSync(TARGET_FILE, content, 'utf8')
    console.log(`\n✅ Successfully applied ${patchCount} patch(es) to node-gyp`)
    console.log('   Visual Studio 2026 Insiders support is now enabled!')
  } catch (error) {
    console.error('\n❌ Error writing patched file:', error.message)
    process.exit(1)
  }
} else {
  console.log('\n✅ All patches already applied - no changes needed')
}

console.log('\n🎉 Done! You can now compile native modules with VS 2026 Insiders.\n')
