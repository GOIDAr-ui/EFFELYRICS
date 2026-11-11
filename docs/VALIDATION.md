# Результаты проверки v0.1 · 11 ноября 2026

Среда: Linux x64, Node.js 24.22.1, npm 11.9.0, .NET SDK 10.0.404. Это отчёт об этой облачной сессии, не о запуске GitHub Actions и не о Windows-тестировании.

| Проверка | Результат |
| --- | --- |
| `npm run lint` | Успешно |
| `npm test` | 33 теста, 3 файла, все прошли |
| `npm run typecheck` | Успешно |
| `npm run build` | Vite production и Electron main/preload bundles собраны |
| `AURORA_CHROMIUM=/usr/bin/chromium npm run test:e2e` | 3 сценария прошли: demo/TTML/пауза/seek/настройки/диагностика, узкое окно, модель preload с отсутствующими метаданными/сменой трека/потерей сессии/неизвестной позицией |
| `npm audit --omit=dev --audit-level=high` | 0 уязвимостей runtime-зависимостей на момент проверки |
| `.NET publish`, Windows x64 self-contained | Успешно, WindowsMediaBridge.exe скомпилирован; выполнение не проверено |
| `electron-builder --win portable --x64 --publish never` | Успешно, `release/Aurora-Lyrics-0.1.0-x64-portable.exe`, 137 258 056 байт |
| Содержимое Windows-пакета | В app.asar есть renderer/main/preload, в resources/bridge — WindowsMediaBridge.exe |
| `electron-builder --win nsis` | Не завершён: Linux требует Wine; штатный Wine 11 из electron-builder-binaries не запускается (`ntdll`, c0000135). Неполный установщик удалён |
| Запуск Electron на Linux | Заблокирован отсутствием корректно установленного SUID sandbox; защита не отключалась |
| Реальная Apple Music / Windows 11 | Не проверено; требуется ручной чек-лист WINDOWS_TESTING.md |
| GitHub Actions | Workflow добавлен; удалённый запуск в этой сессии не подтверждён |

Portable SHA-256:

```text
4b3963639e7676aae57e77f6ff148494c56a67abc2a388e3fbbc564ddb466a81
```

Для кросс-сборки использовались перенаправленные в `/workspace/.cache` npm/Electron caches без изменения HOME. .NET компилировался вне файловой песочницы, поскольку внутри неё не создавался mutex NuGet-Migrations. TLS и проверки контрольных сумм сохранялись. Electron runtime отдельно установлен штатным `install-electron` с checksum verification. Для Windows предназначен обычный `npm run dist:win`; Wine на Windows не нужен. Подпись сертификатом не настроена.

Браузерные тесты, включая модель preload, не подтверждают работоспособность Windows IPC/WinRT или корректность таймлайна Apple Music. Приложение не объявляется прошедшим Windows-проверку до выполнения ручного чек-листа.
