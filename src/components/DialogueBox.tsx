import React from 'react';
import type { NpcDialogueState } from '../game/types';

interface DialogueBoxProps {
  dialogue: NpcDialogueState;
  onDismiss: () => void;
}

export const DialogueBox: React.FC<DialogueBoxProps> = ({ dialogue, onDismiss }) => {
  return (
    <div
      className="pointer-events-auto w-full max-w-lg mx-auto rounded-xl bg-[rgba(9,13,22,0.94)] border border-teal-400/45 px-4 py-3 shadow-2xl"
      data-testid="npc-dialogue"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-display font-bold text-sm text-white truncate">
            {dialogue.npcName}
          </span>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-teal-400/15 text-teal-300 border border-teal-400/30 shrink-0">
            {dialogue.role}
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur();
            onDismiss();
          }}
          className="text-[11px] font-semibold text-slate-300 hover:text-white px-2 py-0.5 rounded bg-white/10 cursor-pointer shrink-0"
        >
          Close [E]
        </button>
      </div>
      <p className="text-xs sm:text-sm text-slate-100 leading-relaxed">
        “{dialogue.line}”
      </p>
      {dialogue.hint && (
        <p className="text-[11px] text-amber-300 mt-1.5 font-medium">
          {dialogue.hint}
        </p>
      )}
    </div>
  );
};
