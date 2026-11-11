using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Windows.Media.Control;
using Windows.Storage.Streams;

// Line-delimited JSON over inherited stdio. No shell, listener, tokens or private APIs.
internal static class Program
{
    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static GlobalSystemMediaTransportControlsSessionManager? manager;
    private static GlobalSystemMediaTransportControlsSession? selected;
    private static GlobalSystemMediaTransportControlsSessionMediaProperties? properties;
    private static string? artwork;
    private static volatile bool dirty = true;
    private static volatile bool sessionsDirty = true;
    private static DateTimeOffset refreshedAt;
    private static string? lastSentArtwork;
    private static string? lastSentTrackId;
    private static string? propertyError;
    private static void Send(object value) => Console.WriteLine(JsonSerializer.Serialize(value, Json));
    private static bool IsApple(GlobalSystemMediaTransportControlsSession session) =>
        session.SourceAppUserModelId.StartsWith("AppleInc.AppleMusicWin_", StringComparison.OrdinalIgnoreCase)
        || session.SourceAppUserModelId.Equals("AppleMusic.exe", StringComparison.OrdinalIgnoreCase);
    public static async Task Main()
    {
        try
        {
            manager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
            manager.SessionsChanged += (_, _) => sessionsDirty = true;
            // Polling is deliberate: catches timeline/command changes even when event delivery is incomplete.
            var commands = Task.Run(ReadCommands);
            while (!commands.IsCompleted)
            {
                await Gate.WaitAsync();
                try { await Snapshot(); }
                catch (Exception ex) { Send(new { kind = "snapshot", data = new { connection = "error", message = $"Windows Media Session: {ex.GetType().Name}" } }); }
                finally { Gate.Release(); }
                await Task.Delay(250);
            }
            await commands;
        }
        catch (Exception ex) { Send(new { kind = "snapshot", data = new { connection = "error", message = $"WinRT недоступен: {ex.GetType().Name}" } }); }
        finally { if (selected != null) selected.MediaPropertiesChanged -= OnPropertiesChanged; }
    }
    private static void OnPropertiesChanged(GlobalSystemMediaTransportControlsSession sender, MediaPropertiesChangedEventArgs args) => dirty = true;
    private static async Task Snapshot()
    {
        var sessions = manager!.GetSessions();
        var next = sessions.FirstOrDefault(IsApple);
        if (sessionsDirty || next?.SourceAppUserModelId != selected?.SourceAppUserModelId)
        {
            if (selected != null) selected.MediaPropertiesChanged -= OnPropertiesChanged;
            sessionsDirty = false; selected = next; lastSentArtwork = null; properties = null; artwork = null; propertyError = null; dirty = true;
            if (selected != null) selected.MediaPropertiesChanged += OnPropertiesChanged;
        }
        if (selected == null)
        {
            Send(new { kind = "snapshot", data = new { connection = "unavailable", message = "Сессия Apple Music не найдена. Запустите воспроизведение или включите деморежим.", sessions = sessions.Select(s => s.SourceAppUserModelId).ToArray() } });
            return;
        }
        if (dirty || DateTimeOffset.UtcNow - refreshedAt > TimeSpan.FromSeconds(5))
        {
            dirty = false; refreshedAt = DateTimeOffset.UtcNow;
            try { properties = await selected.TryGetMediaPropertiesAsync(); propertyError = null; }
            catch (Exception ex) { properties = null; propertyError = $"Метаданные недоступны: {ex.GetType().Name}"; dirty = true; }
            artwork = null;
            if (properties?.Thumbnail != null)
            {
                try
                {
                    using var stream = await properties.Thumbnail.OpenReadAsync();
                    if (stream.Size > 0 && stream.Size <= 2_000_000 && new[] { "image/jpeg", "image/png", "image/webp" }.Contains(stream.ContentType))
                    {
                        using var reader = new DataReader(stream.GetInputStreamAt(0));
                        var size = (uint)stream.Size;
                        await reader.LoadAsync(size);
                        var bytes = new byte[size]; reader.ReadBytes(bytes);
                        artwork = $"data:{stream.ContentType};base64,{Convert.ToBase64String(bytes)}";
                    }
                }
                catch { /* Artwork is optional. Never fail the media session for it. */ }
            }
        }
        var info = selected.GetPlaybackInfo();
        var timeline = selected.GetTimelineProperties();
        var playing = info.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing;
        // GSMTC timestamps use UTC. Anchor the position at observation time to avoid stale-position jitter.
        var age = Math.Max(0, (DateTimeOffset.UtcNow - timeline.LastUpdatedTime).TotalSeconds);
        var positionKnown = timeline.LastUpdatedTime > DateTimeOffset.UnixEpoch;
        var duration = (timeline.EndTime - timeline.StartTime).TotalSeconds;
        var rate = info.PlaybackRate ?? 1;
        var position = Math.Max(0, (timeline.Position - timeline.StartTime).TotalSeconds + (playing ? age * rate : 0));
        if (duration > 0) position = Math.Min(position, duration);
        var identity = selected.SourceAppUserModelId + "\n" + properties?.Title + "\n" + properties?.Artist + "\n" + properties?.AlbumTitle + "\n" + properties?.TrackNumber;
        var trackId = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(identity)));
        var controls = info.Controls;
        Send(new { kind = "snapshot", data = new {
            connection = "connected", message = propertyError, sourceId = selected.SourceAppUserModelId,
            trackId,
            title = properties?.Title, artist = properties?.Artist, album = properties?.AlbumTitle, artwork = artwork != lastSentArtwork || trackId != lastSentTrackId ? artwork : null, artworkChanged = artwork != lastSentArtwork || trackId != lastSentTrackId,
            playback = playing ? "playing" : info.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Paused ? "paused" : "stopped",
            position = positionKnown ? (double?)position : null, duration = duration > 0 ? (double?)duration : null, rate, timelineAge = age,
            capabilities = new { toggle = controls.IsPlayPauseToggleEnabled, next = controls.IsNextEnabled, previous = controls.IsPreviousEnabled },
            sessions = sessions.Select(s => s.SourceAppUserModelId).ToArray()
        }});
        lastSentArtwork = artwork; lastSentTrackId = trackId;
    }
    private static async Task ReadCommands()
    {
        while (await Console.In.ReadLineAsync() is { } line)
        {
            int id = 0;
            await Gate.WaitAsync();
            try
            {
                using var request = JsonDocument.Parse(line);
                id = request.RootElement.GetProperty("id").GetInt32();
                var command = request.RootElement.GetProperty("command").GetString();
                var controls = selected?.GetPlaybackInfo().Controls;
                var ok = selected != null && controls != null && (command switch {
                    "toggle" when controls.IsPlayPauseToggleEnabled => await selected.TryTogglePlayPauseAsync(),
                    "next" when controls.IsNextEnabled => await selected.TrySkipNextAsync(),
                    "previous" when controls.IsPreviousEnabled => await selected.TrySkipPreviousAsync(),
                    _ => false
                });
                Send(new { kind = "result", id, ok, error = ok ? null : "Команда недоступна или отклонена Apple Music." });
            }
            catch (Exception ex) { Send(new { kind = "result", id, ok = false, error = ex.GetType().Name }); }
            finally { Gate.Release(); }
        }
    }
}
