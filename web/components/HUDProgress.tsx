export default function HUDProgress({ value = 0 }: { value?: number }) {
  // NOTE: 簡易HUD進捗。タスク完了時に発光アニメなどを載せていく想定。
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-neon text-opacity-70">
        <span>Progress</span>
        <span>{clamped}%</span>
      </div>
      <div className="h-2 bg-white/5 rounded">
        <div className="h-2 bg-neon rounded shadow-glow" style={{ width: `${clamped}%`, transition: 'width .3s ease' }} />
      </div>
    </div>
  );
}
