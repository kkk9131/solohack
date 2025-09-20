export default function SettingsPage() {
  return (
    <main className="min-h-dvh p-6 md:p-10 space-y-8">
      <h2 className="font-pixel pixel-title text-neon text-2xl">Settings</h2>
      <div className="grid gap-6 max-w-xl">
        <section className="hud-card p-4 space-y-3">
          <h3 className="text-neon">AI相棒</h3>
          <div className="text-sm text-neon text-opacity-70">名前・口調・出力速度（MVPでは未保存）</div>
        </section>
        <section className="hud-card p-4 space-y-3">
          <h3 className="text-neon">API キー</h3>
          <div className="text-sm text-neon text-opacity-70">OpenAI / Supabase の入力欄（Server Actions で保存予定）</div>
        </section>
        <section className="hud-card p-4 space-y-3">
          <h3 className="text-neon">テーマ</h3>
          <div className="text-sm text-neon text-opacity-70">ネオンカラーの選択（デフォルト: 青）</div>
        </section>
      </div>
    </main>
  );
}
