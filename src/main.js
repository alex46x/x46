import { BackgroundScene } from './scene.js';
import { sound } from './audio.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Minimal Ambient 3D Canvas
  const scene = new BackgroundScene('webgl-canvas');

  // DOM Elements
  const dialogueStream = document.getElementById('dialogue-stream');
  const contactFlow = document.getElementById('lisa-contact-flow');
  const scrollHelper = document.getElementById('scroll-helper-hint');
  const talkBtn = document.getElementById('btn-talk');
  const resetBtn = document.getElementById('btn-reset');
  const soundCapsule = document.getElementById('sound-capsule');

  // ----------------------------------------------------
  // 2. Locomotive LISA Dialogue Stream Controller (Overview)
  // ----------------------------------------------------
  const steps = Array.from(document.querySelectorAll('.dialogue-step'));
  const totalSteps = steps.length;
  let currentStep = 0;
  let isScrolling = false;
  let isFormMode = false;

  function updateSteps(newStep) {
    if (newStep < 0 || newStep >= totalSteps) return;
    if (newStep === currentStep && steps[currentStep].classList.contains('active')) return;

    sound.playClick();
    currentStep = newStep;
    if (scene) scene.setStep(currentStep);

    steps.forEach((step, idx) => {
      step.classList.remove('active', 'past', 'upcoming');

      if (idx === currentStep) {
        step.classList.add('active');
      } else if (idx === currentStep - 1) {
        // Immediately previous step: Blurred above (like user screenshot)
        step.classList.add('past');
      } else {
        // Older or future steps: Hidden
        step.classList.add('upcoming');
      }
    });
  }

  // Scroll Wheel / Trackpad Gesture Handler
  window.addEventListener('wheel', (e) => {
    if (isFormMode || isScrolling) return;

    if (Math.abs(e.deltaY) > 25) {
      isScrolling = true;

      if (e.deltaY > 0) {
        if (currentStep < totalSteps - 1) updateSteps(currentStep + 1);
      } else {
        if (currentStep > 0) updateSteps(currentStep - 1);
      }

      setTimeout(() => { isScrolling = false; }, 500);
    }
  }, { passive: true });

  // Touch gestures for mobile
  let touchStartY = 0;
  window.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) touchStartY = e.touches[0].clientY;
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    if (isFormMode || isScrolling) return;
    if (e.changedTouches.length === 1) {
      const deltaY = touchStartY - e.changedTouches[0].clientY;
      if (Math.abs(deltaY) > 40) {
        isScrolling = true;
        if (deltaY > 0 && currentStep < totalSteps - 1) {
          updateSteps(currentStep + 1);
        } else if (deltaY < 0 && currentStep > 0) {
          updateSteps(currentStep - 1);
        }
        setTimeout(() => { isScrolling = false; }, 500);
      }
    }
  }, { passive: true });

  // Dialogue Pill Actions
  document.querySelectorAll('#dialogue-stream .pill-action').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;

      if (action === 'talk') {
        openContactFlow();
      } else if (action === 'next') {
        if (currentStep < totalSteps - 1) updateSteps(currentStep + 1);
      } else if (action === 'prev') {
        if (currentStep > 0) updateSteps(currentStep - 1);
      } else if (action === 'reset') {
        updateSteps(0);
      }
    });
  });

  // ----------------------------------------------------
  // 3. Conversational Contact Form Flow (Locomotive LISA Style)
  // ----------------------------------------------------
  const flowPrevBlur = document.getElementById('flow-prev-blur');
  const flowPromptText = document.getElementById('flow-prompt-text');
  const flowInput = document.getElementById('flow-current-input');
  const flowForm = document.getElementById('flow-form');
  const flowBtnBack = document.getElementById('flow-btn-back');
  const flowProgressStep = document.getElementById('flow-progress-step');
  const flowActiveBox = document.getElementById('flow-active-box');
  const flowSuccessBox = document.getElementById('flow-success-box');
  const flowSuccessText = document.getElementById('flow-success-text');
  const flowBtnClose = document.getElementById('flow-btn-close');
  const flowBtnRestart = document.getElementById('flow-btn-restart');

  let formStep = 0;
  const formData = {
    name: '',
    email: '',
    message: ''
  };

  const formQuestions = [
    {
      prompt: "Let's make it official. I need a name to put on your project brief.",
      placeholder: "Your name",
      type: "text",
      progress: "Step 1 of 3"
    },
    {
      prompt: (data) => `Great to meet you, ${data.name || 'friend'}. What's your email so I can follow up?`,
      placeholder: "Your email address",
      type: "email",
      progress: "Step 2 of 3"
    },
    {
      prompt: "What are we building together? Tell me a little about your vision or scope.",
      placeholder: "A 3D website, interactive experience...",
      type: "text",
      progress: "Step 3 of 3"
    }
  ];

  function renderFormStep(stepIdx) {
    formStep = stepIdx;
    sound.playClick();

    if (formStep >= formQuestions.length) {
      // Completed State
      flowActiveBox.style.display = 'none';
      flowSuccessBox.style.display = 'flex';
      flowPrevBlur.textContent = `Client brief transmitted for ${formData.name}.`;
      flowSuccessText.textContent = `Transmission received! Thanks, ${formData.name}. I will review your idea and reply to ${formData.email} within 24 hours.`;
      sound.playChime(660, 0.05, 0.4);
      return;
    }

    flowActiveBox.style.display = 'flex';
    flowSuccessBox.style.display = 'none';

    const q = formQuestions[formStep];
    const prevQ = formStep > 0 ? formQuestions[formStep - 1] : null;

    // Blurred previous line above
    if (prevQ) {
      const prevPrompt = typeof prevQ.prompt === 'function' ? prevQ.prompt(formData) : prevQ.prompt;
      flowPrevBlur.textContent = prevPrompt;
    } else {
      flowPrevBlur.textContent = '';
    }

    // Active prompt & input
    flowPromptText.textContent = typeof q.prompt === 'function' ? q.prompt(formData) : q.prompt;
    flowInput.value = '';
    flowInput.type = q.type;
    flowInput.placeholder = q.placeholder;
    flowProgressStep.textContent = q.progress;

    setTimeout(() => flowInput.focus(), 150);
  }

  function openContactFlow() {
    isFormMode = true;
    dialogueStream.style.display = 'none';
    contactFlow.style.display = 'flex';
    scrollHelper.style.display = 'none';
    talkBtn.querySelector('span').textContent = 'Close ✕';
    if (scene) scene.setFormMode(true);
    renderFormStep(0);
  }

  function closeContactFlow() {
    isFormMode = false;
    contactFlow.style.display = 'none';
    dialogueStream.style.display = 'flex';
    scrollHelper.style.display = 'flex';
    talkBtn.querySelector('span').textContent = "Let's talk";
    if (scene) scene.setFormMode(false);
    updateSteps(currentStep);
  }

  // Handle Form Submission / Next Step
  if (flowForm) {
    flowForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = flowInput.value.trim();
      if (!val) return;

      if (formStep === 0) {
        formData.name = val;
      } else if (formStep === 1) {
        formData.email = val;
      } else if (formStep === 2) {
        formData.message = val;
      }

      renderFormStep(formStep + 1);
    });
  }

  // Back Button inside form
  if (flowBtnBack) {
    flowBtnBack.addEventListener('click', () => {
      if (formStep > 0) {
        renderFormStep(formStep - 1);
      } else {
        closeContactFlow();
      }
    });
  }

  // Form Completion Action Buttons
  if (flowBtnClose) flowBtnClose.addEventListener('click', closeContactFlow);
  if (flowBtnRestart) {
    flowBtnRestart.addEventListener('click', () => {
      formData.name = '';
      formData.email = '';
      formData.message = '';
      renderFormStep(0);
    });
  }

  // ----------------------------------------------------
  // 4. Header & Global Controls
  // ----------------------------------------------------
  // "Let's talk" Header Button
  if (talkBtn) {
    talkBtn.addEventListener('click', () => {
      if (!isFormMode) {
        openContactFlow();
      } else {
        closeContactFlow();
      }
    });
  }

  // Reset Button (↺)
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (isFormMode) closeContactFlow();
      updateSteps(0);
      if (scene) scene.reset();
      sound.playChime(440, 0.04, 0.3);
    });
  }

  // Quick Copy Email Pill
  const copyPill = document.getElementById('pill-copy-email');
  if (copyPill) {
    copyPill.addEventListener('click', async (e) => {
      e.stopPropagation();
      const email = copyPill.dataset.email || 'hello@portfolio.design';
      try {
        await navigator.clipboard.writeText(email);
        sound.playChime(660, 0.05, 0.3);

        const span = copyPill.querySelector('span');
        if (span) {
          const originalText = span.textContent;
          span.textContent = '✓ Copied to clipboard!';
          copyPill.style.background = '#FFFFFF';
          copyPill.style.borderColor = '#10B981';

          setTimeout(() => {
            span.textContent = originalText;
            copyPill.style.background = '';
            copyPill.style.borderColor = '';
          }, 2000);
        }
      } catch (err) {
        console.warn('Clipboard write failed:', err);
      }
    });
  }

  // Sound Toggle Capsule (Locomotive.mp3)
  if (soundCapsule) {
    soundCapsule.addEventListener('click', () => {
      const isSoundOn = sound.toggle();
      if (scene) scene.setAudioActive(isSoundOn);
      if (isSoundOn) {
        soundCapsule.classList.add('active');
        soundCapsule.setAttribute('aria-label', 'Mute ambient audio');
      } else {
        soundCapsule.classList.remove('active');
        soundCapsule.setAttribute('aria-label', 'Unmute ambient audio');
      }
    });
  }

  // Keyboard Navigation
  window.addEventListener('keydown', (e) => {
    if (isFormMode) {
      if (e.key === 'Escape') closeContactFlow();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      if (currentStep < totalSteps - 1) updateSteps(currentStep + 1);
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      if (currentStep > 0) updateSteps(currentStep - 1);
    }
  });
});
