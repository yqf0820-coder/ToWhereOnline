# natapp Windows 一键安装脚本  version: 3.0.3
# 用法 (PowerShell):
#   powershell -c "irm https://natapp.cn/get.ps1?authtoken=<你的token> | iex"
#
# 示例:
#   powershell -c "irm https://natapp.cn/get.ps1?authtoken=f3e5s4n8x9q2 | iex"
#
# authtoken 获取地址: https://natapp.cn/tunnel/lists
# ──────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

$NATAPP_VERSION = "3.0.3"
$INSTALL_DIR    = $PWD.Path
$NATAPP_SCRIPT_BASE = "https://natapp.cn"
# authtoken 由服务端烘焙进脚本（通过 URL ?authtoken=xxx 传入）
$AUTHTOKEN      = "15be9ccdbcd1b102"
$KEY            = "6561"

if (-not $AUTHTOKEN) {
    Write-Host "[natapp] 错误：缺少 authtoken" -ForegroundColor Red
    Write-Host ""
    Write-Host "用法:" -ForegroundColor White
    Write-Host "  powershell -c `"irm $NATAPP_SCRIPT_BASE/get.ps1?authtoken=<你的token> | iex`"" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "authtoken 获取地址: $NATAPP_SCRIPT_BASE/tunnel/lists" -ForegroundColor Cyan
    exit 1
}

# ── 颜色输出 ─────────────────────────────────
function Write-Info    { param($msg) Write-Host "[natapp] $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "[natapp] $msg" -ForegroundColor Green }
function Write-Warn    { param($msg) Write-Host "[natapp] $msg" -ForegroundColor Yellow }
function Write-Err     { param($msg) Write-Host "[natapp] ERROR: $msg" -ForegroundColor Red; exit 1 }

# ── 检测 CPU 架构 ────────────────────────────
function Get-Arch {
    $arch = $env:PROCESSOR_ARCHITECTURE
    if ($arch -eq "AMD64" -or $arch -eq "EM64T") { return "amd64" }
    if ($arch -eq "x86")   { return "386" }
    if ($arch -eq "ARM64") { return "arm64" }
    Write-Err "不支持的 CPU 架构: $arch"
}

# ── 获取下载地址 ─────────────────────────────
function Get-DownloadUrl {
    param([string]$arch)
    switch ($arch) {
        "386" { return "http://download.natapp.cn/assets/downloads/clients/3_0_3/natapp_windows_386_3_0_3.zip" }
        "amd64" { return "http://download.natapp.cn/assets/downloads/clients/3_0_3/natapp_windows_amd64_3_0_3.zip" }
        default { Write-Err "暂无适合当前架构的安装包 ($arch)，请前往 https://natapp.cn 手动下载" }
    }
}

# ── 主流程 ───────────────────────────────────
Write-Info "natapp 一键安装脚本 v${NATAPP_VERSION}"
Write-Info "官网: https://natapp.cn"
Write-Host ""

$arch = Get-Arch
Write-Info "检测到架构: $arch"

$url = Get-DownloadUrl $arch
if ($KEY) {
    if ($url -match '\?') { $url = "${url}&key=${KEY}&authtoken=${AUTHTOKEN}" } else { $url = "${url}?key=${KEY}&authtoken=${AUTHTOKEN}" }
} else {
    if ($url -match '\?') { $url = "${url}&authtoken=${AUTHTOKEN}" } else { $url = "${url}?authtoken=${AUTHTOKEN}" }
}
Write-Info "下载地址: $url"

# 检测是否已安装同版本
$existingExe = Join-Path $INSTALL_DIR "natapp.exe"
if (Test-Path $existingExe) {
    $oldVer = & $existingExe version 2>$null
    if ($oldVer -and $oldVer.Trim() -eq $NATAPP_VERSION) {
        Write-Success "natapp v${NATAPP_VERSION} 已是最新版本，无需重复安装"
        Write-Info "当前 natapp 文件: $existingExe"
        Write-Host ""
        Write-Host "  双击以下文件启动隧道:" -ForegroundColor White
        Write-Host "  $(Join-Path $INSTALL_DIR 'run_natapp.bat')" -ForegroundColor Green
        Write-Host ""
        exit 0
    }
    Write-Warn "检测到已安装的 natapp（v$($oldVer.Trim())），将升级为 v${NATAPP_VERSION}"
}

# 下载 zip 到临时目录
$zipFile = Join-Path $env:TEMP "natapp_${NATAPP_VERSION}_${arch}.zip"
Write-Info "正在下载..."
try {
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $url -OutFile $zipFile -UseBasicParsing
} catch {
    Write-Err "下载失败: $_"
}

# 解压到当前目录
Write-Info "正在解压到 $INSTALL_DIR ..."
try {
    Expand-Archive -Path $zipFile -DestinationPath $INSTALL_DIR -Force
} catch {
    Write-Err "解压失败: $_"
}
Remove-Item $zipFile -Force -ErrorAction SilentlyContinue

# 查找可执行文件
$exeFile = Get-ChildItem -Path $INSTALL_DIR -Filter "natapp.exe" -Recurse | Select-Object -First 1
if (-not $exeFile) {
    Write-Err "解压后未找到 natapp.exe，请前往 https://natapp.cn 手动下载"
}
$exePath = $exeFile.FullName
Write-Success "✓ natapp v${NATAPP_VERSION} 已下载到: $exePath"

# 生成 bat 启动文件
$batPath = Join-Path $INSTALL_DIR "run_natapp.bat"
@"
@echo  off
:: natapp 启动脚本（由安装程序自动生成）
:: 双击此文件即可启动 natapp 隧道
::
:: 加入系统服务（开机自启）参考: "$exePath" -authtoken=$AUTHTOKEN -service help
:: 运行多条隧道: 仿照此文件，将 authtoken 替换为其他隧道的 token，另存为新文件运行
"$exePath" -authtoken=$AUTHTOKEN
pause
"@ | Set-Content -Path $batPath -Encoding Default

Write-Host ""
Write-Success "✓ 安装完成！"
Write-Host ""
Write-Host "  双击以下文件即可启动 natapp 隧道:" -ForegroundColor White
Write-Host "  $batPath" -ForegroundColor Green
Write-Host ""
Write-Host "  ──────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "  加入系统服务（开机自启）参考:" -ForegroundColor White
Write-Host "  `"$exePath`" -authtoken=$AUTHTOKEN -service help" -ForegroundColor Yellow
Write-Host ""
Write-Host "  运行多条隧道:" -ForegroundColor White
Write-Host "  仿照 run_natapp.bat，将 authtoken 替换为其他隧道的 token，另存为新文件运行" -ForegroundColor Gray
Write-Host "  例如: 复制 $batPath 为 run_natapp_2.bat，修改其中的 authtoken" -ForegroundColor Gray
Write-Host "  ──────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""
