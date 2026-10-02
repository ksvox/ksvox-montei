export default function AuthCard({ children }) {
  return (
    <div className="min-h-screen flex justify-center bg-ks-bg">
      <div className="w-full max-w-[420px] px-6" style={{ paddingTop: 'calc(48px + env(safe-area-inset-top))', paddingBottom: 'calc(28px + env(safe-area-inset-bottom))' }}>
        <div className="text-center mb-8">
          <img src="/logo.png" alt="K's VOX MEMBER APP" className="w-24 h-24 mx-auto rounded-[22px] shadow-md" />
          <h1 className="font-serif font-extrabold text-2xl mt-5 tracking-wide">門弟アプリ</h1>
        </div>
        <div className="card p-6 text-center leading-relaxed">{children}</div>
      </div>
    </div>
  );
}
