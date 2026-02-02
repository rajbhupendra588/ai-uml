import Canvas from "@/components/Canvas";

export default function Home() {
  return (
    <main 
      className="flex h-screen w-screen flex-col overflow-hidden transition-colors duration-300"
      style={{ backgroundColor: "var(--background)" }}
    >
      <div className="flex h-full flex-1 flex-col overflow-hidden" style={{ minHeight: 0 }}>
        <Canvas />
      </div>
    </main>
  );
}
