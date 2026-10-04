@echo off
chcp 65001 >nul
title dapperpack.com 本地预览 - 请勿关闭此窗口
cd /d "%~dp0"

echo ============================================================
echo   dapperpack.com 生产站点 - 本地预览
echo   地址: http://127.0.0.1:8131/
echo   线上地址: https://dapperpack.com/
echo   关闭此窗口即停止预览
echo ============================================================
echo.

where python >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 python 命令。
  echo 请安装 Python 或把 python 加入 PATH 后重试。
  echo.
  pause
  exit /b 1
)

start "" "http://127.0.0.1:8131/"
python -m http.server 8131 --bind 127.0.0.1

echo.
echo 服务器已停止。
pause
