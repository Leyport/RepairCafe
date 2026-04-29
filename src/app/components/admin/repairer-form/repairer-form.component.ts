import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Repairer } from '../../../models/repairer.model';
import { RepairService } from '../../../services/repair.service';
import { AvatarService } from '../../../services/avatar.service';
import { inject, OnChanges, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-repairer-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="overlay-backdrop" (click)="close()">
      <div class="overlay-content glass" (click)="$event.stopPropagation()">
        <header>
          <h2>{{ repairer?.id ? 'Edit Repairer' : 'Add Repairer' }}</h2>
          <button class="btn-close" (click)="close()">×</button>
        </header>

        <div class="form-group">
          <!-- Avatar Section -->
          <div class="avatar-section">
            <div class="avatar-preview"
              [style.backgroundImage]="'url(' + (photoPreview || photoUrl || 'assets/placeholder-avatar.png') + ')'"
              [class.emoji-draggable]="!!selectedEmoji"
              [class.dragging]="isDraggingEmoji"
              (mousedown)="onAvatarDragStart($event)">
              <div class="overlay"></div>
            </div>

            <div class="mode-toggles">
                <button class="btn-toggle" [class.active]="!isCameraMode" (click)="setEmojiMode()">Choose Emoji</button>
                <button class="btn-toggle" [class.active]="isCameraMode" (click)="setCameraMode()">Take Photo</button>
            </div>

            <div class="emoji-section" *ngIf="!isCameraMode">
                <div class="emoji-search-bar">
                    <input
                        type="text"
                        [(ngModel)]="emojiSearchQuery"
                        placeholder="Search emojis..."
                        class="emoji-search-input">
                </div>
                <button type="button" class="btn-emoji-toggle" (click)="emojiGridExpanded = !emojiGridExpanded">
                    {{ emojiGridExpanded ? 'Hide Emojis ▲' : 'Show Emojis ▼' }}
                </button>
                <div class="emoji-grid custom-scrollbar" *ngIf="emojiGridExpanded">
                    <button
                        *ngFor="let item of filteredEmojis"
                        class="emoji-btn"
                        [title]="item.name"
                        (click)="selectEmoji(item.emoji)">
                        {{ item.emoji }}
                    </button>
                    <div *ngIf="filteredEmojis.length === 0" class="no-emoji-results">
                        No emojis found
                    </div>
                </div>
            </div>

            <div class="camera-section" *ngIf="isCameraMode">
                <video class="camera-video" autoplay playsinline muted></video>
                <div class="camera-controls">
                    <button class="btn-capture" (click)="capturePhoto()">📸 Capture</button>
                    <button class="btn-cancel-camera" (click)="setEmojiMode()">Cancel</button>
                </div>
            </div>

          </div>

          <label for="repairerName">Name</label>
          <input
            type="text"
            id="repairerName"
            [(ngModel)]="name"
            placeholder="Enter repairer name"
            autofocus>

          <label for="repairerEmail">Email Address</label>
          <input
            type="email"
            id="repairerEmail"
            [(ngModel)]="email"
            placeholder="Enter email address">

          <div class="primary-toggle" *ngIf="isAdmin">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="isPrimary">
              <span class="checkmark"></span>
              Primary Repairer
            </label>
            <small class="hint">Primary repairers can be assigned to repair items</small>
          </div>
        </div>

        <footer>
          <button class="btn-delete" *ngIf="repairer?.id" (click)="delete()">Delete</button>
          <div class="actions">
            <button class="btn-cancel" (click)="close()">Cancel</button>
            <button class="btn-save" (click)="save()" [disabled]="!name.trim() || isUploading">{{ isUploading ? 'Saving...' : 'Save' }}</button>
          </div>
        </footer>
      </div>
    </div>
  `,
  styles: [`
    .overlay-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(4px);
      z-index: 1000;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      overflow-y: auto;
      padding: 2rem 1rem;
      box-sizing: border-box;
    }

    .overlay-content {
      width: 100%;
      max-width: 400px;
      background: #1a1a2e;
      padding: 2rem;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
      display: flex;
      flex-direction: column;
      margin: auto 0;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }

    h2 {
      margin: 0;
      font-size: 1.5rem;
      color: white;
    }

    .btn-close {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.5);
      font-size: 2rem;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }

    .form-group {
      margin-bottom: 2rem;
      overflow-y: auto;
    }

    label {
      display: block;
      margin-bottom: 0.5rem;
      color: rgba(255, 255, 255, 0.7);
    }

    input[type="text"] {
      width: 100%;
      padding: 0.8rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      color: white;
      font-size: 1rem;
    }

    input:focus {
      outline: none;
      border-color: var(--accent-color);
    }

    footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: auto;
    }

    .actions {
      display: flex;
      gap: 1rem;
      margin-left: auto;
    }

    button {
      padding: 0.6rem 1.2rem;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
    }

    .btn-delete {
      background: rgba(255, 77, 77, 0.1);
      color: #ff4d4d;
    }
    .btn-delete:hover {
      background: rgba(255, 77, 77, 0.2);
    }

    .btn-cancel {
      background: rgba(255, 255, 255, 0.05);
      color: rgba(255, 255, 255, 0.7);
    }
    .btn-cancel:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    .btn-save {
      background: var(--accent-color);
      color: #000;
      font-weight: 600;
    }
    .btn-save:hover {
      opacity: 0.9;
    }
    .btn-save:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .text-danger {
      color: #ff4d4d !important;
    }
    .text-danger:hover {
      background: rgba(255, 77, 77, 0.1) !important;
    }

    /* Avatar Styles */
    .avatar-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .avatar-preview {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background-size: cover;
      background-position: center;
      background-color: rgba(255, 255, 255, 0.1);
      border: 2px solid rgba(255, 255, 255, 0.2);
      position: relative;
      overflow: hidden;
      cursor: pointer;
    }

    .avatar-preview .overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .avatar-preview:hover .overlay {
      opacity: 1;
    }

    .avatar-preview.emoji-draggable {
      cursor: grab;
    }
    .avatar-preview.emoji-draggable.dragging {
      cursor: grabbing;
    }
    .avatar-preview.emoji-draggable.dragging .overlay {
      opacity: 0;
    }

    .avatar-actions {
      display: flex;
      gap: 1rem;
    }

    .btn-text {
      background: none;
      border: none;
      color: var(--accent-color);
      font-size: 0.9rem;
      cursor: pointer;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
    }
    
    .btn-text:hover {
      background: rgba(255, 255, 255, 0.05);
    }

    .mode-toggles {
        display: flex;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        padding: 4px;
        gap: 4px;
        width: 100%;
    }
    
    .btn-toggle {
        flex: 1;
        background: transparent;
        color: rgba(255, 255, 255, 0.6);
        padding: 0.5rem;
        font-size: 0.85rem;
        border: none;
        cursor: pointer;
        border-radius: 6px;
        transition: all 0.2s;
    }
    .btn-toggle.active {
        background: var(--accent-color);
        color: black;
        font-weight: 600;
    }

    .search-section {
        margin: 1rem 0;
    }

    .search-bar {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 1rem;
    }

    .search-bar input {
        flex: 1;
        padding: 0.6rem;
        background: rgba(0,0,0,0.2);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        color: white;
        font-size: 0.9rem;
    }

    .btn-search {
        padding: 0 1rem;
        background: rgba(255,255,255,0.1);
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
    }

    .search-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.5rem;
        max-height: 200px;
        overflow-y: auto;
        padding-right: 5px;
    }

    .search-item {
        aspect-ratio: 1;
        background-size: cover;
        background-position: center;
        border-radius: 4px;
        cursor: pointer;
        border: 2px solid transparent;
        transition: all 0.2s;
    }

    .search-item:hover {
        transform: scale(1.05);
        border-color: var(--accent-color);
    }

    .no-results {
        text-align: center;
        color: rgba(255,255,255,0.4);
        font-size: 0.9rem;
        padding: 1rem;
    }
    
    .emoji-section {
        width: 100%;
    }

    .emoji-search-bar {
        margin-bottom: 0.5rem;
    }

    .emoji-search-input {
        width: 100%;
        padding: 0.5rem 0.75rem;
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 6px;
        color: white;
        font-size: 0.9rem;
        box-sizing: border-box;
    }

    .emoji-search-input:focus {
        outline: none;
        border-color: var(--accent-color);
    }

    .btn-emoji-toggle {
        width: 100%;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 6px;
        color: rgba(255, 255, 255, 0.6);
        font-size: 0.82rem;
        padding: 0.4rem 0.75rem;
        cursor: pointer;
        text-align: left;
        margin-bottom: 0.4rem;
        transition: background 0.2s, color 0.2s;
    }
    .btn-emoji-toggle:hover {
        background: rgba(255, 255, 255, 0.09);
        color: rgba(255, 255, 255, 0.85);
    }

    .emoji-grid {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 0.5rem;
        max-height: 150px;
        overflow-y: auto;
        padding: 0.5rem;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        width: 100%;
        box-sizing: border-box;
    }

    .emoji-btn {
        background: transparent;
        border: none;
        font-size: 1.5rem;
        padding: 0.5rem;
        cursor: pointer;
        border-radius: 6px;
        transition: transform 0.1s;
    }
    .emoji-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        transform: scale(1.2);
    }

    .no-emoji-results {
        grid-column: 1 / -1;
        text-align: center;
        color: rgba(255, 255, 255, 0.4);
        font-size: 0.85rem;
        padding: 1rem 0;
    }

    .camera-section {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
    }

    .camera-video {
        width: 100%;
        max-height: 180px;
        border-radius: 8px;
        background: #000;
        object-fit: cover;
        display: block;
    }

    .camera-controls {
        display: flex;
        gap: 0.75rem;
        width: 100%;
    }

    .btn-capture {
        flex: 1;
        background: var(--accent-color);
        color: #000;
        font-weight: 600;
        border: none;
        border-radius: 8px;
        padding: 0.65rem;
        cursor: pointer;
        font-size: 1rem;
        transition: opacity 0.2s;
    }
    .btn-capture:hover { opacity: 0.85; }

    .btn-cancel-camera {
        background: rgba(255, 255, 255, 0.07);
        color: rgba(255, 255, 255, 0.65);
        border: none;
        border-radius: 8px;
        padding: 0.65rem 1rem;
        cursor: pointer;
        transition: background 0.2s;
    }
    .btn-cancel-camera:hover { background: rgba(255,255,255,0.12); }

    .primary-toggle {
      margin-top: 1.2rem;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      cursor: pointer;
      color: rgba(255, 255, 255, 0.9);
      font-size: 1rem;
    }

    .checkbox-label input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: var(--accent-color);
      cursor: pointer;
    }

    .hint {
      display: block;
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.4);
      margin-top: 0.3rem;
    }
  `]
})
export class RepairerFormComponent implements OnChanges, OnDestroy {
  private repairService = inject(RepairService);
  private avatarService = inject(AvatarService);

  @Input() repairer: Repairer | null = null;
  @Input() isAdmin = false;
  @Output() closeEvent = new EventEmitter<void>();
  @Output() saveEvent = new EventEmitter<{ id?: string, name: string, photoUrl?: string, isPrimary: boolean, email: string }>();
  @Output() deleteEvent = new EventEmitter<string>();

  name = '';
  email = '';
  isPrimary = false;
  photoUrl: string | null = null;
  photoPreview: string | null = null;
  selectedFile: File | null = null;
  isUploading = false;
  isEmojiMode = true;
  isSearchMode = false;
  isSearching = false;
  searchQuery = '';
  searchResults: string[] = [];
  emojiSearchQuery = '';
  emojiGridExpanded = false;
  selectedEmoji = '';
  emojiOffsetX = 50;
  emojiOffsetY = 50;
  isDraggingEmoji = false;
  isCameraMode = false;
  private cameraStream: MediaStream | null = null;
  private dragLastX = 0;
  private dragLastY = 0;

  emojiData = [
    { emoji: '😀', name: 'grinning', keywords: ['smile', 'happy', 'face', 'grin'] },
    { emoji: '😃', name: 'big smile', keywords: ['smile', 'happy', 'face', 'joy'] },
    { emoji: '😄', name: 'grinning eyes', keywords: ['smile', 'happy', 'laugh'] },
    { emoji: '😁', name: 'beaming', keywords: ['smile', 'happy', 'grin'] },
    { emoji: '😆', name: 'laughing', keywords: ['laugh', 'happy', 'haha'] },
    { emoji: '😅', name: 'sweat smile', keywords: ['nervous', 'sweat', 'laugh'] },
    { emoji: '😂', name: 'tears of joy', keywords: ['laugh', 'cry', 'funny', 'lol'] },
    { emoji: '🤣', name: 'rofl', keywords: ['laugh', 'floor', 'funny', 'rolling'] },
    { emoji: '😊', name: 'smiling', keywords: ['smile', 'happy', 'blush', 'cute'] },
    { emoji: '😇', name: 'angel', keywords: ['angel', 'halo', 'innocent', 'good'] },
    { emoji: '🙂', name: 'slightly smiling', keywords: ['smile', 'happy'] },
    { emoji: '🙃', name: 'upside down', keywords: ['silly', 'sarcasm'] },
    { emoji: '😉', name: 'winking', keywords: ['wink', 'cheeky'] },
    { emoji: '😍', name: 'heart eyes', keywords: ['love', 'heart', 'adore'] },
    { emoji: '🥰', name: 'smiling hearts', keywords: ['love', 'heart', 'cute'] },
    { emoji: '😎', name: 'cool', keywords: ['cool', 'sunglasses', 'awesome'] },
    { emoji: '🤓', name: 'nerd', keywords: ['nerd', 'glasses', 'geek', 'smart'] },
    { emoji: '🧐', name: 'monocle', keywords: ['fancy', 'monocle', 'smart', 'inspect'] },
    { emoji: '🤩', name: 'star struck', keywords: ['star', 'excited', 'wow', 'famous'] },
    { emoji: '🥳', name: 'partying', keywords: ['party', 'celebrate', 'birthday'] },
    { emoji: '😏', name: 'smirking', keywords: ['smirk', 'sly', 'cheeky'] },
    { emoji: '🤔', name: 'thinking', keywords: ['think', 'hmm', 'wonder', 'pondering'] },
    { emoji: '🤗', name: 'hugging', keywords: ['hug', 'warm', 'friendly'] },
    { emoji: '😤', name: 'triumph', keywords: ['steam', 'proud', 'determined'] },
    { emoji: '💪', name: 'flexed bicep', keywords: ['strong', 'muscle', 'flex', 'power'] },
    { emoji: '👍', name: 'thumbs up', keywords: ['good', 'ok', 'yes', 'approve', 'like'] },
    { emoji: '👋', name: 'waving hand', keywords: ['wave', 'hello', 'hi', 'bye'] },
    { emoji: '🙌', name: 'raised hands', keywords: ['celebrate', 'hooray', 'praise'] },
    { emoji: '👏', name: 'clapping', keywords: ['clap', 'applause', 'bravo', 'well done'] },
    { emoji: '🦊', name: 'fox', keywords: ['fox', 'animal', 'cute', 'clever'] },
    { emoji: '🐱', name: 'cat', keywords: ['cat', 'kitty', 'animal', 'pet'] },
    { emoji: '🦁', name: 'lion', keywords: ['lion', 'animal', 'king', 'brave'] },
    { emoji: '🐶', name: 'dog', keywords: ['dog', 'puppy', 'animal', 'pet'] },
    { emoji: '🐵', name: 'monkey', keywords: ['monkey', 'animal', 'funny'] },
    { emoji: '🐻', name: 'bear', keywords: ['bear', 'animal', 'teddy'] },
    { emoji: '🐨', name: 'koala', keywords: ['koala', 'animal', 'cute'] },
    { emoji: '🐼', name: 'panda', keywords: ['panda', 'animal', 'cute'] },
    { emoji: '🐹', name: 'hamster', keywords: ['hamster', 'animal', 'cute'] },
    { emoji: '🐰', name: 'rabbit', keywords: ['rabbit', 'bunny', 'animal'] },
    { emoji: '🐯', name: 'tiger', keywords: ['tiger', 'animal', 'stripe'] },
    { emoji: '🐮', name: 'cow', keywords: ['cow', 'animal', 'farm'] },
    { emoji: '🐷', name: 'pig', keywords: ['pig', 'animal', 'farm', 'oink'] },
    { emoji: '🐸', name: 'frog', keywords: ['frog', 'animal', 'green'] },
    { emoji: '🐙', name: 'octopus', keywords: ['octopus', 'sea', 'tentacles'] },
    { emoji: '🦄', name: 'unicorn', keywords: ['unicorn', 'magic', 'mythical'] },
    { emoji: '🐝', name: 'bee', keywords: ['bee', 'insect', 'honey', 'buzz'] },
    { emoji: '🐞', name: 'ladybug', keywords: ['ladybug', 'insect', 'bug', 'red'] },
    { emoji: '🦋', name: 'butterfly', keywords: ['butterfly', 'insect', 'pretty'] },
    { emoji: '🦉', name: 'owl', keywords: ['owl', 'bird', 'wise', 'night'] },
    { emoji: '🐢', name: 'turtle', keywords: ['turtle', 'slow', 'animal', 'shell'] },
    { emoji: '🦖', name: 'dinosaur', keywords: ['dinosaur', 'dino', 'rex', 'ancient'] },
    { emoji: '🐳', name: 'whale', keywords: ['whale', 'sea', 'ocean', 'big'] },
    { emoji: '🦈', name: 'shark', keywords: ['shark', 'sea', 'ocean', 'fish'] },
    { emoji: '🔨', name: 'hammer', keywords: ['hammer', 'tool', 'hit', 'build', 'repair', 'fix'] },
    { emoji: '🔧', name: 'wrench', keywords: ['wrench', 'tool', 'fix', 'repair', 'spanner'] },
    { emoji: '🪛', name: 'screwdriver', keywords: ['screwdriver', 'tool', 'fix', 'repair', 'screw'] },
    { emoji: '🔩', name: 'nut and bolt', keywords: ['nut', 'bolt', 'screw', 'tool', 'fix'] },
    { emoji: '⚙️', name: 'gear', keywords: ['gear', 'cog', 'settings', 'mechanical', 'engine'] },
    { emoji: '🪚', name: 'saw', keywords: ['saw', 'tool', 'cut', 'wood', 'carpentry'] },
    { emoji: '🔑', name: 'key', keywords: ['key', 'lock', 'open', 'access'] },
    { emoji: '🪝', name: 'hook', keywords: ['hook', 'hang', 'catch'] },
    { emoji: '🧰', name: 'toolbox', keywords: ['toolbox', 'tools', 'kit', 'repair', 'fix'] },
    { emoji: '🧲', name: 'magnet', keywords: ['magnet', 'attract', 'metal'] },
    { emoji: '🔬', name: 'microscope', keywords: ['microscope', 'science', 'lab', 'examine'] },
    { emoji: '🔭', name: 'telescope', keywords: ['telescope', 'space', 'stars', 'look'] },
    { emoji: '💡', name: 'light bulb', keywords: ['bulb', 'idea', 'light', 'electric'] },
    { emoji: '🔋', name: 'battery', keywords: ['battery', 'power', 'electric', 'charge'] },
    { emoji: '🔌', name: 'plug', keywords: ['plug', 'electric', 'power', 'socket'] },
    { emoji: '💻', name: 'laptop', keywords: ['laptop', 'computer', 'tech', 'pc'] },
    { emoji: '🖥️', name: 'desktop', keywords: ['desktop', 'computer', 'monitor', 'screen'] },
    { emoji: '📱', name: 'phone', keywords: ['phone', 'mobile', 'smartphone', 'call'] },
    { emoji: '⌨️', name: 'keyboard', keywords: ['keyboard', 'type', 'computer'] },
    { emoji: '🖨️', name: 'printer', keywords: ['printer', 'print', 'office'] },
    { emoji: '📷', name: 'camera', keywords: ['camera', 'photo', 'picture', 'photograph'] },
    { emoji: '📻', name: 'radio', keywords: ['radio', 'music', 'broadcast', 'retro'] },
    { emoji: '📺', name: 'tv', keywords: ['tv', 'television', 'screen', 'watch'] },
    { emoji: '🎵', name: 'music note', keywords: ['music', 'note', 'song', 'sound'] },
    { emoji: '🎸', name: 'guitar', keywords: ['guitar', 'music', 'instrument', 'rock'] },
    { emoji: '🎹', name: 'piano', keywords: ['piano', 'music', 'instrument', 'keyboard'] },
    { emoji: '🧶', name: 'yarn', keywords: ['yarn', 'knit', 'sewing', 'craft', 'wool'] },
    { emoji: '🧵', name: 'thread', keywords: ['thread', 'sew', 'stitch', 'needle', 'craft'] },
    { emoji: '✂️', name: 'scissors', keywords: ['scissors', 'cut', 'craft', 'sew'] },
    { emoji: '📐', name: 'ruler', keywords: ['ruler', 'measure', 'angle', 'geometry'] },
    { emoji: '📏', name: 'straight ruler', keywords: ['ruler', 'measure', 'length'] },
    { emoji: '🪣', name: 'bucket', keywords: ['bucket', 'pail', 'water'] },
    { emoji: '🧹', name: 'broom', keywords: ['broom', 'sweep', 'clean'] },
    { emoji: '🪴', name: 'plant', keywords: ['plant', 'green', 'nature', 'pot'] },
    { emoji: '⭐', name: 'star', keywords: ['star', 'gold', 'favourite', 'best'] },
    { emoji: '🌟', name: 'glowing star', keywords: ['star', 'shine', 'glow', 'bright'] },
    { emoji: '🏆', name: 'trophy', keywords: ['trophy', 'win', 'champion', 'award'] },
    { emoji: '🎯', name: 'target', keywords: ['target', 'aim', 'goal', 'bullseye'] },
    { emoji: '♻️', name: 'recycle', keywords: ['recycle', 'green', 'eco', 'environment', 'repair', 'reuse'] },
    { emoji: '🌱', name: 'seedling', keywords: ['green', 'plant', 'grow', 'eco', 'nature'] },
    { emoji: '🌍', name: 'earth', keywords: ['earth', 'world', 'planet', 'global', 'green'] },
  ];

  get filteredEmojis() {
    const q = this.emojiSearchQuery.trim().toLowerCase();
    if (!q) return this.emojiData;
    return this.emojiData.filter(item =>
      item.name.includes(q) || item.keywords.some(k => k.includes(q))
    );
  }

  ngOnChanges() {
    if (this.repairer) {
      this.name = this.repairer.name;
      this.email = this.repairer.email || '';
      this.photoUrl = this.repairer.photoUrl || null;
      this.photoPreview = null;
      this.isPrimary = this.repairer.isPrimary || false;
    } else {
      this.name = '';
      this.email = '';
      this.photoUrl = null;
      this.photoPreview = null;
      this.isPrimary = false;
    }
    this.selectedFile = null;
    this.isEmojiMode = true;
    this.isSearchMode = false;
    this.searchResults = [];
    this.searchQuery = this.name || '';
    this.emojiSearchQuery = '';
    this.emojiGridExpanded = false;
    this.selectedEmoji = '';
    this.emojiOffsetX = 50;
    this.emojiOffsetY = 50;
    this.stopCamera();
    this.isCameraMode = false;
  }

  ngOnDestroy() {
    this.stopCamera();
  }

  close() {
    this.stopCamera();
    this.closeEvent.emit();
  }

  setCameraMode() {
    this.isCameraMode = true;
    setTimeout(async () => {
      const videoEl = document.querySelector('.camera-video') as HTMLVideoElement;
      if (!videoEl) return;
      try {
        this.cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 400 }, height: { ideal: 400 } }
        });
        videoEl.srcObject = this.cameraStream;
      } catch {
        this.isCameraMode = false;
        alert('Could not access camera. Please check browser permissions.');
      }
    }, 50);
  }

  setEmojiMode() {
    this.stopCamera();
    this.isCameraMode = false;
  }

  capturePhoto() {
    const videoEl = document.querySelector('.camera-video') as HTMLVideoElement;
    if (!videoEl || !videoEl.videoWidth) return;

    const size = 200;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    const crop = Math.min(vw, vh);
    ctx.drawImage(videoEl, (vw - crop) / 2, (vh - crop) / 2, crop, crop, 0, 0, size, size);

    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' viewBox='0 0 200 200'><image width='200' height='200' href='${imageDataUrl}' preserveAspectRatio='xMidYMid slice'/></svg>`;
    this.photoPreview = `data:image/svg+xml;base64,${btoa(svg)}`;
    this.selectedEmoji = '';
    this.selectedFile = null;
    this.stopCamera();
    this.isCameraMode = false;
  }

  stopCamera() {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(t => t.stop());
      this.cameraStream = null;
    }
  }

  selectEmoji(emoji: string) {
    this.selectedEmoji = emoji;
    this.emojiOffsetX = 50;
    this.emojiOffsetY = 50;
    this.renderEmojiPreview();
  }

  private renderEmojiPreview() {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text x='${this.emojiOffsetX}' y='${this.emojiOffsetY}' text-anchor='middle' dominant-baseline='central' font-family="Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif" font-size='80'>${this.selectedEmoji}</text></svg>`;
    const base64 = btoa(unescape(encodeURIComponent(svg)));
    this.photoPreview = `data:image/svg+xml;base64,${base64}`;
    this.selectedFile = null;
  }

  onAvatarDragStart(event: MouseEvent) {
    if (!this.selectedEmoji) return;
    this.isDraggingEmoji = true;
    this.dragLastX = event.clientX;
    this.dragLastY = event.clientY;
    event.preventDefault();
  }

  @HostListener('document:mousemove', ['$event'])
  onDocumentMouseMove(event: MouseEvent) {
    if (!this.isDraggingEmoji || !this.selectedEmoji) return;
    const dx = event.clientX - this.dragLastX;
    const dy = event.clientY - this.dragLastY;
    this.dragLastX = event.clientX;
    this.dragLastY = event.clientY;
    this.emojiOffsetX = Math.max(5, Math.min(95, this.emojiOffsetX + dx));
    this.emojiOffsetY = Math.max(5, Math.min(95, this.emojiOffsetY + dy));
    this.renderEmojiPreview();
  }

  @HostListener('document:mouseup')
  onDocumentMouseUp() {
    this.isDraggingEmoji = false;
  }

  onAvatarSearch() {
    if (!this.searchQuery.trim()) return;
    this.isSearching = true;
    this.avatarService.searchAvatars(this.searchQuery).subscribe({
      next: (results: string[]) => {
        this.searchResults = results;
        this.isSearching = false;
      },
      error: (err: any) => {
        console.error('Avatar search failed:', err);
        this.isSearching = false;
      }
    });
  }

  async selectInternetAvatar(url: string) {
    this.isUploading = true;
    try {
      const storedUrl = await this.repairService.downloadAndUploadPhoto(url);
      this.photoUrl = storedUrl;
      this.photoPreview = storedUrl;
      this.isSearchMode = false;
    } catch (err) {
      alert('Failed to save selected avatar. It might be blocked by CORS.');
    } finally {
      this.isUploading = false;
    }
  }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    // Basic validation
    if (file.size > 5 * 1024 * 1024) { // 5MB
      alert('File is too large. Max 5MB.');
      return;
    }

    this.selectedFile = file;
    this.selectedEmoji = '';
    this.isEmojiMode = false; // Switch tab

    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.photoPreview = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  removePhoto() {
    this.photoUrl = null;
    this.photoPreview = null;
    this.selectedFile = null;
    this.selectedEmoji = '';
  }

  delete() {
    if (this.repairer?.id) {
      if (confirm('Are you sure you want to delete this repairer?')) {
        this.deleteEvent.emit(this.repairer.id);
      }
    }
  }

  async save() {
    if (!this.name.trim()) return;

    this.isUploading = true;
    try {
      let finalPhotoUrl = this.repairer?.photoUrl; // Default to existing

      if (this.selectedFile) {
        // Upload new file
        finalPhotoUrl = await this.repairService.uploadRepairerPhoto(this.selectedFile);
      } else if (this.photoPreview && this.photoPreview.startsWith('data:image/svg+xml')) {
        // Use SVG Data URI (Emoji)
        finalPhotoUrl = this.photoPreview;
      } else if (!this.photoPreview && !this.photoUrl) {
        // Explicitly removed
        finalPhotoUrl = undefined;
      } else if (this.photoUrl) {
        // kept existing
        finalPhotoUrl = this.photoUrl;
      }

      this.saveEvent.emit({
        id: this.repairer?.id,
        name: this.name,
        email: this.email,
        photoUrl: finalPhotoUrl,
        isPrimary: this.isPrimary
      });
    } catch (error) {
      console.error('Error saving repairer:', error);
      alert('Failed to save repairer.');
    } finally {
      this.isUploading = false;
    }
  }
}
