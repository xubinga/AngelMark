import { spawnSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const require = createRequire(import.meta.url)
const packageJson = require(path.join(projectRoot, 'package.json'))
const electronPackageJson = require(path.join(projectRoot, 'node_modules', 'electron', 'package.json'))
const electronVersion = electronPackageJson.version
const runtimeCacheRoot = path.join(projectRoot, 'release', '.runtime-cache')

const channel = process.argv[2] === 'debug' ? 'debug' : 'release'

const config = {
  release: {
    buildScript: 'build:web',
    appName: 'AngelMark',
    packageDirName: 'AngelMarkPortable',
    executableName: 'AngelMark',
    outputDir: path.join(projectRoot, 'release', 'win-release'),
    runtimeDir: '%LOCALAPPDATA%\\AngelMark\\runtime\\release',
    artifactName: `AngelMark-${packageJson.version}-win-x64-release.exe`,
    zipName: 'angelmark-release.zip',
    includeSourceMap: false,
  },
  debug: {
    buildScript: 'build:web:debug',
    appName: 'AngelMark Debug',
    packageDirName: 'AngelMark Debug',
    executableName: 'AngelMark Debug',
    outputDir: path.join(projectRoot, 'release', 'win-debug'),
    runtimeDir: '%LOCALAPPDATA%\\AngelMark\\runtime\\debug',
    artifactName: `AngelMark-Debug-${packageJson.version}-win-x64.exe`,
    zipName: 'angelmark-debug.zip',
    includeSourceMap: true,
  },
}[channel]

const escapePowerShell = (value) => value.replace(/'/g, "''")

const findElectronZipCandidates = () => {
  const tempRoot = process.env.TEMP ?? os.tmpdir()
  const zipName = `electron-v${electronVersion}-win32-x64.zip`
  const candidates = []
  const projectCachedZip = path.join(runtimeCacheRoot, zipName)

  if (existsSync(projectCachedZip)) {
    candidates.push({
      path: projectCachedZip,
      size: statSync(projectCachedZip).size,
      mtimeMs: statSync(projectCachedZip).mtimeMs,
    })
  }

  if (!existsSync(tempRoot)) {
    return candidates
  }

  for (const entry of readdirSync(tempRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('electron-download-')) {
      continue
    }

    const candidate = path.join(tempRoot, entry.name, zipName)
    if (existsSync(candidate)) {
      candidates.push({
        path: candidate,
        size: statSync(candidate).size,
        mtimeMs: statSync(candidate).mtimeMs,
      })
    }
  }

  candidates.sort((left, right) => {
    if (right.size !== left.size) {
      return right.size - left.size
    }
    return right.mtimeMs - left.mtimeMs
  })

  return candidates
}

const extractElectronZip = (zipPath) => {
  const extractedDir = path.join(runtimeCacheRoot, `electron-v${electronVersion}-win32-x64`)
  const runtimeExe = path.join(extractedDir, 'electron.exe')

  if (existsSync(runtimeExe)) {
    return extractedDir
  }

  ensureCleanDir(extractedDir)

  const powershell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh'
  const command = [
    "$ErrorActionPreference = 'Stop'",
    `Expand-Archive -LiteralPath '${escapePowerShell(zipPath)}' -DestinationPath '${escapePowerShell(extractedDir)}' -Force`,
  ].join('; ')

  run(powershell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command])

  if (!existsSync(runtimeExe)) {
    throw new Error(`Electron 运行时解压失败: ${runtimeExe}`)
  }

  return extractedDir
}

const detectRuntimeSource = () => {
  const electronMarker = path.join(projectRoot, 'node_modules', 'electron', 'path.txt')
  const electronDist = path.join(projectRoot, 'node_modules', 'electron', 'dist')
  const electronExecutable = existsSync(electronMarker)
    ? readFileSync(electronMarker, 'utf8').trim()
    : 'electron.exe'

  if (existsSync(path.join(electronDist, electronExecutable))) {
    return electronDist
  }

  const cachedZips = findElectronZipCandidates()
  for (const candidate of cachedZips) {
    try {
      return extractElectronZip(candidate.path)
    } catch (error) {
      console.warn(`跳过损坏的 Electron ZIP: ${candidate.path}`)
      console.warn(error instanceof Error ? error.message : error)
    }
  }

  const hostRuntimeCandidates = [
    path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Microsoft VS Code'),
    path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Trae'),
    path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'cursor'),
  ]

  for (const candidate of hostRuntimeCandidates) {
    if (existsSync(candidate)) {
      console.warn(`未找到纯 Electron 运行时，回退使用本机宿主运行时: ${candidate}`)
      return candidate
    }
  }

  throw new Error(
    [
      '未找到纯 Electron 运行时。',
      `请先执行一次 Electron 下载，或确保临时目录中存在 electron-v${electronVersion}-win32-x64.zip。`,
      '不再使用 VS Code / Trae 安装目录作为运行时来源，以避免混入宿主应用文件。',
    ].join(' '),
  )
}

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`命令执行失败: ${command} ${args.join(' ')}`)
  }
}

const ensureCleanDir = (target) => {
  rmSync(target, { recursive: true, force: true })
  mkdirSync(target, { recursive: true })
}

const buildWebAssets = () => {
  console.log(`\n[1/4] 构建前端资源 (${channel})`)
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  run(npmCommand, ['run', config.buildScript])
}

const packageElectronApp = () => {
  console.log(`\n[2/4] 封装 Electron 应用目录 (${channel})`)
  ensureCleanDir(config.outputDir)

  const packageDir = path.join(config.outputDir, `${config.packageDirName}-win32-x64`)
  ensureCleanDir(packageDir)
  const runtimeSource = detectRuntimeSource()
  const appResourcesDir = path.join(packageDir, 'resources', 'app')
  const appNodeModulesDir = path.join(appResourcesDir, 'node_modules')
  const electronLogSrc = path.join(projectRoot, 'node_modules', 'electron-log')
  const electronLogDest = path.join(appNodeModulesDir, 'electron-log')
  const runtimeExeName = [
    'electron.exe',
    'Electron.exe',
    'Code.exe',
    'Trae.exe',
    'Cursor.exe',
  ].find((name) => existsSync(path.join(runtimeSource, name))) ?? null

  if (!runtimeExeName) {
    throw new Error(`Electron 运行时目录缺少可执行文件: ${runtimeSource}`)
  }
  const runtimeExe = path.join(packageDir, runtimeExeName)
  const appExe = path.join(packageDir, `${config.executableName}.exe`)

  cpSync(runtimeSource, packageDir, { recursive: true, force: true })
  rmSync(path.join(packageDir, 'resources', 'app'), { recursive: true, force: true })
  rmSync(path.join(packageDir, 'resources', 'default_app.asar'), { force: true })
  ensureCleanDir(appResourcesDir)
  ensureCleanDir(appNodeModulesDir)

  cpSync(path.join(projectRoot, 'dist'), path.join(appResourcesDir, 'dist'), {
    recursive: true,
    force: true,
  })
  cpSync(path.join(projectRoot, 'electron'), path.join(appResourcesDir, 'electron'), {
    recursive: true,
    force: true,
  })
  cpSync(electronLogSrc, electronLogDest, {
    recursive: true,
    force: true,
  })

  const runtimePackage = {
    name: config.appName.toLowerCase().replace(/\s+/g, '-'),
    productName: config.appName,
    version: packageJson.version,
    main: 'electron/main.mjs',
    type: 'module',
    dependencies: {
      'electron-log': packageJson.dependencies['electron-log'],
    },
  }

  writeFileSync(
    path.join(appResourcesDir, 'package.json'),
    `${JSON.stringify(runtimePackage, null, 2)}\n`,
    'utf8',
  )

  if (!config.includeSourceMap) {
    const assetsDir = path.join(appResourcesDir, 'dist', 'assets')
    if (existsSync(assetsDir)) {
      for (const file of readdirSync(assetsDir)) {
        if (file.endsWith('.map')) {
          rmSync(path.join(assetsDir, file), { force: true })
        }
      }
    }

    const localesDir = path.join(packageDir, 'locales')
    if (existsSync(localesDir)) {
      for (const file of readdirSync(localesDir)) {
        if (file !== 'en-US.pak' && file !== 'zh-CN.pak') {
          rmSync(path.join(localesDir, file), { force: true })
        }
      }
    }
  }

  for (const redundantPath of [
    path.join(packageDir, 'bin'),
    path.join(packageDir, 'tools'),
    path.join(packageDir, 'policies'),
    path.join(packageDir, 'libEGL.dll'),
    path.join(packageDir, 'libGLESv2.dll'),
    path.join(packageDir, 'resources', 'app-update.yml'),
    path.join(packageDir, 'Code.VisualElementsManifest.xml'),
    path.join(packageDir, 'new_Code.exe'),
    path.join(packageDir, 'new_Code.VisualElementsManifest.xml'),
    path.join(packageDir, 'unins000.dat'),
    path.join(packageDir, 'unins000.exe'),
    path.join(packageDir, 'unins000.msg'),
    path.join(packageDir, 'updating_version'),
  ]) {
    rmSync(redundantPath, { recursive: true, force: true })
  }

  for (const redundantAppPath of [
    path.join(appResourcesDir, 'extensions'),
    path.join(appResourcesDir, 'licenses'),
    path.join(appResourcesDir, 'out'),
    path.join(appResourcesDir, 'resources'),
    path.join(appResourcesDir, 'node_modules.asar.unpacked'),
    path.join(appResourcesDir, 'LICENSE.rtf'),
    path.join(appResourcesDir, 'node_modules.asar'),
    path.join(appResourcesDir, 'product.json'),
    path.join(appResourcesDir, 'telemetry-core.json'),
    path.join(appResourcesDir, 'telemetry-extensions.json'),
    path.join(appResourcesDir, 'ThirdPartyNotices.txt'),
  ]) {
    rmSync(redundantAppPath, { recursive: true, force: true })
  }

  for (const entry of readdirSync(packageDir)) {
    if (/^[0-9a-f]{10}$/i.test(entry)) {
      rmSync(path.join(packageDir, entry), { recursive: true, force: true })
    }
  }

  if (existsSync(runtimeExe)) {
    renameSync(runtimeExe, appExe)
  }

  return packageDir
}

const compressPackageDir = (packageDir, zipPath) => {
  console.log(`\n[3/4] 压缩桌面目录到单文件载荷 (${channel})`)
  const powershell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh'
  const command = [
    "$ErrorActionPreference = 'Stop'",
    `if (Test-Path '${escapePowerShell(zipPath)}') { Remove-Item -Force '${escapePowerShell(zipPath)}' }`,
    `Compress-Archive -Path '${escapePowerShell(path.join(packageDir, '*'))}' -DestinationPath '${escapePowerShell(zipPath)}' -Force`,
  ].join('; ')

  run(powershell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command])
}

const createLauncher = (zipName, launcherPath) => {
  const launcher = [
    '@echo off',
    'setlocal',
    `set "TARGET_DIR=${config.runtimeDir}"`,
    'if exist "%TARGET_DIR%" rmdir /s /q "%TARGET_DIR%"',
    'mkdir "%TARGET_DIR%"',
    `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '%~dp0${zipName}' -DestinationPath '%TARGET_DIR%' -Force"`,
    `start "" "%TARGET_DIR%\\${config.executableName}.exe"`,
  ].join('\r\n')

  writeFileSync(launcherPath, launcher, 'utf8')
}

const createSed = (stageDir, launcherPath, zipPath, targetExe) => {
  const toWinPath = (value) => value.replace(/\//g, '\\')
  const stage = toWinPath(stageDir)
  const sed = [
    '[Version]',
    'Class=IEXPRESS',
    'SEDVersion=3',
    '[Options]',
    'PackagePurpose=InstallApp',
    'ShowInstallProgramWindow=0',
    'HideExtractAnimation=1',
    'UseLongFileName=1',
    'InsideCompressed=0',
    'CAB_FixedSize=0',
    'CAB_ResvCodeSigning=0',
    'RebootMode=N',
    'InstallPrompt=',
    'DisplayLicense=',
    'FinishMessage=',
    `TargetName=${toWinPath(targetExe)}`,
    `FriendlyName=${config.appName}`,
    'AppLaunched=cmd.exe /c launch.cmd',
    'PostInstallCmd=<None>',
    'AdminQuietInstCmd=cmd.exe /c launch.cmd',
    'UserQuietInstCmd=cmd.exe /c launch.cmd',
    'SourceFiles=SourceFiles',
    '[Strings]',
    `FILE0="${path.basename(zipPath)}"`,
    `FILE1="${path.basename(launcherPath)}"`,
    '[SourceFiles]',
    `SourceFiles0=${stage}\\`,
    '[SourceFiles0]',
    '%FILE0%=',
    '%FILE1%=',
    '',
  ].join('\r\n')

  const sedPath = path.join(stageDir, `${channel}.sed`)
  writeFileSync(sedPath, sed, 'utf8')
  return sedPath
}

const buildSingleExe = (sedPath) => {
  console.log(`\n[4/4] 生成单文件 EXE (${channel})`)
  const iexpress = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'iexpress.exe')
  if (!existsSync(iexpress)) {
    throw new Error('IExpress 未找到，无法生成单文件 EXE。')
  }

  run(iexpress, ['/N', '/Q', sedPath], {
    shell: false,
  })
}

const main = async () => {
  buildWebAssets()

  const packageDir = packageElectronApp()
  const stageDir = path.join(config.outputDir, 'stage')
  const zipPath = path.join(stageDir, config.zipName)
  const launcherPath = path.join(stageDir, 'launch.cmd')
  const targetExe = path.join(config.outputDir, config.artifactName)

  ensureCleanDir(stageDir)
  compressPackageDir(packageDir, zipPath)
  createLauncher(config.zipName, launcherPath)

  const sedPath = createSed(stageDir, launcherPath, zipPath, targetExe)
  buildSingleExe(sedPath)

  console.log(`\n已生成 ${channel} 版本: ${targetExe}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
