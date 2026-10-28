import { TetrisBoard } from '@/components/TetrisBoard';

export default function Home() {
  return (
    <main className="min-h-screen bg-black flex items-center justify-center overflow-auto">
      <div className="relative z-10 w-full">
        <TetrisBoard />
      </div>
    </main>
  );
}
