import { SignIn } from "@clerk/nextjs";
import Image from "next/image";

export default function Page() {
  return (
    // Mantendo a correção da tela dividida (fixed inset-0)
    <div className="fixed inset-0 z-50 overflow-y-auto flex flex-col items-center justify-center bg-black px-4">
      
      <div className="mb-8 flex flex-col items-center gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
        
        {/* LOGO GIGANTE */}
        {/* Mobile: w-80 (320px) | PC: w-[450px] */}
        <div className="relative w-80 h-48 md:w-[450px] md:h-64">
          <Image 
            src="/logo-login.png" 
            alt="KORE Logo"
            fill
            className="object-contain drop-shadow-2xl"
            priority
          />
        </div>

        <p className="text-zinc-300 text-lg font-medium tracking-wide text-center -mt-4">
          Entre para dominar suas finanças.
        </p>
      </div>

      <SignIn 
        appearance={{
          elements: {
            formButtonPrimary: "bg-green-600 hover:bg-green-700 text-white transition-all py-3",
            card: "bg-zinc-900 border border-zinc-800 shadow-xl shadow-black/50 backdrop-blur-sm",
            headerTitle: "hidden", 
            headerSubtitle: "hidden",
            socialButtonsBlockButton: "bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700 py-2.5",
            socialButtonsBlockButtonText: "text-white font-medium",
            formFieldLabel: "text-zinc-300 font-medium",
            formFieldInput: "bg-zinc-950 border-zinc-800 text-white focus:border-green-500 py-3",
            footerActionLink: "text-green-500 hover:text-green-400 font-bold",
            identityPreviewText: "text-zinc-300",
            formFieldInputShowPasswordButton: "text-zinc-400 hover:text-white"
          }
        }}
      />
    </div>
  );
}