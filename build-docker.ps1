# ===== 配置 =====
$CONTAINER_PORT = 8080
$HOST_PORT = 8080

# ===== 菜单 =====
Write-Host "请选择操作：" -ForegroundColor Cyan
Write-Host "1 - 构建并运行容器"
Write-Host "2 - 仅构建镜像"

$choice = Read-Host "请输入选项编号"

# ===== 读取 package.json =====
if (-not (Test-Path "package.json")) {
    Write-Host "未找到 package.json，脚本终止" -ForegroundColor Red
    exit 1
}

try {
    $package = Get-Content "package.json" -Raw | ConvertFrom-Json
    $PROJECT_NAME = $package.name
    $VERSION = $package.version
} catch {
    Write-Host "解析 package.json 失败：$_" -ForegroundColor Red
    exit 1
}

if (-not $PROJECT_NAME -or -not $VERSION) {
    Write-Host "package.json 中缺少 name 或 version" -ForegroundColor Red
    exit 1
}

# ===== 生成时间戳 =====
$BUILD_TIMESTAMP = Get-Date -Format "yyyyMMddHHmm-ss"

# ===== 构建镜像 =====
Write-Host "`n正在构建镜像..." -ForegroundColor Green
docker buildx build `
    -t "$PROJECT_NAME`:$VERSION-$BUILD_TIMESTAMP" `
    -f "./Dockerfile" `
    .

if ($LASTEXITCODE -ne 0) {
    Write-Host "镜像构建失败" -ForegroundColor Red
    exit 1
}

docker tag "$PROJECT_NAME`:$VERSION-$BUILD_TIMESTAMP" "$PROJECT_NAME`:latest"
Write-Host "镜像构建完成！" -ForegroundColor Green

# ===== 根据选择执行 =====
switch ($choice) {
    "1" {
        Write-Host "`n正在停止并移除旧容器..." -ForegroundColor Yellow

        docker stop $PROJECT_NAME 2>$null | Out-Null
        docker rm $PROJECT_NAME 2>$null | Out-Null

        Write-Host "正在运行新容器..."
        docker run -d `
            -p "${HOST_PORT}:${CONTAINER_PORT}" `
            --name $PROJECT_NAME `
            "$PROJECT_NAME`:$VERSION-$BUILD_TIMESTAMP"

        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n容器已启动：" -ForegroundColor Green
            Write-Host "http://localhost:$HOST_PORT"
        } else {
            Write-Host "容器启动失败" -ForegroundColor Red
        }
    }

    "2" {
        Write-Host "`n仅构建镜像完成！" -ForegroundColor Green
    }

    default {
        Write-Host "`n无效的选择，请重新运行脚本并输入 1 或 2" -ForegroundColor Red
    }
}