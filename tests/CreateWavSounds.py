# CreateWavSounds.py
# This script generates a WAV file containing various sound patterns including scale notes, sweeps, white noise, and varied volume sounds.
# It uses sine waves for the notes and white noise for the noise section.
# The generated audio is saved as a WAV file with specified parameters.
import numpy as np
from scipy.io.wavfile import write
import math
import os

def get_c_frequencies(min_frequency, max_frequency):
    # Define the reference frequency for C4 (middle C)
    C4_FREQUENCY = 261.63

    # Define the semitone offsets for all notes in the C major scale (C, D, E, F, G, A, B)
    C_MAJOR_OFFSETS = [0, 2, 4, 5, 7, 9, 11]

    # Generate frequencies for all octaves in the range
    frequencies = []
    first_note_below_min = None
    last_note_above_max = None

    # Start from C1 (approx. 32.7 Hz) and calculate up to C8
    for octave in range(-3, 4):  # C1 to C7 (middle C is octave 0 relative to C4)
        for offset in C_MAJOR_OFFSETS:
            # Calculate the frequency of the note
            frequency = C4_FREQUENCY * (2 ** octave) * (2 ** (offset / 12))
            
            # Check if the frequency is below the minimum
            if frequency < min_frequency:
                first_note_below_min = frequency  # Store the first note below the minimum
            # Check if the frequency is above the maximum
            elif frequency > max_frequency:
                if not last_note_above_max:  # Store the first note above the maximum
                    last_note_above_max = frequency
            else:
                # Add to the list if it's within the desired range
                frequencies.append(frequency)

    # Prepend the first note below the minimum and append the last note above the maximum
    if first_note_below_min:
        frequencies.insert(0, first_note_below_min)
    if last_note_above_max:
        frequencies.append(last_note_above_max)

    # Print the resulting frequencies
    print(frequencies)

    return frequencies

def generate_sine_wave(frequency, duration, sample_rate, extend_duration_to_freq_at_zero=True, amplitude=1.0):
    """Generates a sine wave of a given frequency and duration."""
    #print("Duration:", duration, "Frequency:", frequency, "Dur * Freq:", duration * frequency, "Ceiling", np.ceil(duration * frequency), "Sample Rate:", sample_rate)
    dur_ext_to_freq_at_zero = np.ceil(duration * frequency) / frequency
    duration = dur_ext_to_freq_at_zero if extend_duration_to_freq_at_zero else duration
    t = np.linspace(0, duration, math.floor(sample_rate * duration), endpoint=False)
    ret = np.sin(2 * np.pi * frequency * t)

    #print("Ending Point:", ret[-1], "Frequency:", frequency, "Duration:", duration, "Extended Duration to Frequency at Zero:", extend_duration_to_freq_at_zero)
    return ret * amplitude

def create_scale_notes(frequencies, sample_rate, duration_note, duration_silence, num_repetitions, amplitude=1.0):
    """Creates the scale notes as specified with silence between repetitions."""
    notes = []
    silence = np.zeros(int(sample_rate * duration_silence))
    
    for freq in frequencies:
        note = generate_sine_wave(freq, duration_note, sample_rate, amplitude=amplitude)
        # Repeat each note NUM_REPETITIONS times with silence in between
        repeated_notes = np.concatenate([note, silence] * num_repetitions)
        notes.append(repeated_notes)
    
    return np.concatenate(notes)

def create_scale_up_and_down(frequencies, sample_rate, duration_note, amplitude=1.0):
    """Creates notes played upwards and downwards without gaps."""
    notes = []
    
    for freq in frequencies:
        notes.append(generate_sine_wave(freq, duration_note, sample_rate, amplitude=amplitude))
    
    for freq in reversed(frequencies):
        notes.append(generate_sine_wave(freq, duration_note, sample_rate, amplitude=amplitude))
    
    return np.concatenate(notes)

def create_continuous_sweep(duration, sample_rate, min_freq, max_freq, amplitude=1.0, extend_duration_to_freq_at_zero=True):
    """Creates a continuous frequency sweep upwards and downwards."""
    # Sweep parameters
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)

    # Upward sweep
    freq_up = np.linspace(min_freq, max_freq, len(t))
    phase_up = 2 * np.pi * np.cumsum(freq_up) / sample_rate
    sweep_up = np.sin(phase_up)
    last_phase_up = phase_up[-1]

    # Downward sweep
    freq_down = np.linspace(max_freq, min_freq, len(t))
    phase_down = last_phase_up + 2 * np.pi * np.cumsum(freq_down) / sample_rate
    sweep_down = np.sin(phase_down)
    last_phase_down = phase_down[-1]

    if extend_duration_to_freq_at_zero:
        # Compute extra time to reach next zero-crossing
        # Sine crosses zero every pi radians; find remaining phase to next multiple of pi
        remaining_phase = np.pi - (last_phase_down % np.pi)

        # Use final frequency for this extension
        final_freq = min_freq
        phase_per_sample = 2 * np.pi * final_freq / sample_rate
        extra_samples = int(np.ceil(remaining_phase / phase_per_sample))

        # Time for extension
        t_extra = np.arange(extra_samples) / sample_rate
        phase_extra = last_phase_down + phase_per_sample * np.arange(1, extra_samples + 1)
        sweep_extra = np.sin(phase_extra)

        # Combine all parts
        sweep = np.concatenate([sweep_up, sweep_down, sweep_extra])
        print(f"Start: {sweep[0]:.4f}, End: {sweep[-1]:.4f} (should be near zero)")
    else:
        # Combine upward and downward sweeps without extension
        sweep = np.concatenate([sweep_up, sweep_down])
        print(f"Start: {sweep[0]:.4f}, End: {sweep[-1]:.4f}")

    return sweep * amplitude

def create_white_noise(duration, sample_rate, amplitude=1.0):
    """Create white noise for a specified duration and sample rate."""
    # Generate white noise with uniform distribution in the range [-1, 1]
    if amplitude > 1.0:
        amplitude = 1.0
    elif amplitude < 0.0:
        amplitude = 0.0
    
    noise = np.random.uniform(low=-amplitude, high=amplitude, size=int(sample_rate * duration))
    return noise

def create_varied_volume(frequency, sample_rate, duration_note, notes_per_ascent=2, num_periods=2, amplitude=1.0):
    """Create a sound that varies in volume in the specified frequency"""
    duration = duration_note * (notes_per_ascent * 2) * num_periods
    wave = generate_sine_wave(frequency, duration, sample_rate, amplitude=amplitude)

    samples_per_ascent = sample_rate * duration_note * notes_per_ascent
    
    for i in range(len(wave)):
        if (i / samples_per_ascent) % 2 < 1: # Ascent
            wave[i] = wave[i] * ((i % samples_per_ascent) / samples_per_ascent)
        else: # Descent
            wave[i] = wave[i] * (1 - ((i % samples_per_ascent) / samples_per_ascent))

    return wave

def create_three_c_varied_volumes(sample_rate, duration_note, c_freqs=None, amplitude=1.0):
    if c_freqs is None:
        c_freqs = [32.703, 261.626, 2093.005]  # C1, C4, C7
    
    waves = []
    for freq in c_freqs:
        waves.append(create_varied_volume(freq, sample_rate, duration_note, amplitude=amplitude))
    
    return np.concatenate(waves)

def repeat_sound(sound, repetitions, sample_rate, silence_duration):
    """Repeat a sound a specified number of times with silence in between."""
    silence = np.zeros(int(sample_rate * silence_duration))
    return np.concatenate([sound, silence] * repetitions)

def generate_old_standaridation_sound(filename="scale_audio_with_silence_no_pop",
                                      sample_rate=44100,
                                      min_freq=50,
                                      max_freq=2000,
                                      duration_note=0.2,
                                      duration_silence=0.2,
                                      num_repetitions=2,
                                      num_full_audio_playthroughs=2,
                                      duration_between_full_audio_playthroughs=1):
    '''
    Create the old standarization wav file from 2025
    '''
    frequencies = get_c_frequencies(min_freq, max_freq)
    # Combine all parts into a single WAV file
    scale_notes = create_scale_notes(frequencies, sample_rate, duration_note, duration_silence, num_repetitions, amplitude=1.0)
    scale_up_and_down = create_scale_up_and_down(frequencies, sample_rate, duration_note, amplitude=1.0)
    continuous_sweep = create_continuous_sweep(duration_note * len(frequencies) * 2, sample_rate, frequencies[0], frequencies[-1], amplitude=1.0)
    white_noise = repeat_sound(create_white_noise(duration_note, sample_rate, amplitude=1.0), num_repetitions, sample_rate, duration_silence)
    varied_volumes = create_three_c_varied_volumes(sample_rate, duration_note, amplitude=1.0)

    # Silence between each part (scale notes already have silence after)
    silence = np.zeros(int(sample_rate * duration_silence))

    # Combine
    final_audio = np.concatenate([scale_notes, scale_up_and_down, silence, continuous_sweep, silence, white_noise, silence, varied_volumes])
    
    # Add in repetitions
    silence_between_full_audio = np.zeros(int(sample_rate * duration_between_full_audio_playthroughs))
    final_audio = np.concatenate(([final_audio, silence_between_full_audio] * (num_full_audio_playthroughs-1)) + [final_audio])        
    
    # Normalize
    final_audio = np.int16(final_audio / np.max(np.abs(final_audio)) * 32767)
    print(final_audio.max(), final_audio.min())
    print(final_audio)

    # Save to WAV file
    os.makedirs("./sounds", exist_ok=True)
    filename = filename.strip()
    if not filename.endswith(".wav"):
        filename += ".wav"
    filepath = f"./sounds/{filename}"
    write(filepath, sample_rate, final_audio)
    print("WAV file '" + filepath + "' created successfully!")

def generate_v1_pathogen_sound(filename="path_freq_exp_v1.wav",
                               sample_rate=44100,
                               min_freq=50,
                               max_freq=2000,
                               duration_silence=0.2,
                               num_full_audio_playthroughs=2,
                               duration_between_full_audio_playthroughs=1):
    '''
    Generate pathogen sound used from 4/1/26 to Current
    '''
    
    # Create the sequence: 20s sweep 50%, 10s noise 50%, 20s sweep 100%, 10s noise 100%
    sweep_20s_50 = create_continuous_sweep(10, sample_rate, min_freq, max_freq, amplitude=0.5)
    noise_10s_50 = create_white_noise(10, sample_rate, amplitude=0.5)
    sweep_20s_100 = create_continuous_sweep(10, sample_rate, min_freq, max_freq, amplitude=1.0)
    noise_10s_100 = create_white_noise(10, sample_rate, amplitude=1.0)
    
    silence = np.zeros(int(sample_rate * duration_silence))
    
    sequence = np.concatenate([sweep_20s_50, silence, noise_10s_50, silence, sweep_20s_100, silence, noise_10s_100])
    
    # Repeat the sequence num_full_audio_playthroughs times with silence between
    silence_between = np.zeros(int(sample_rate * duration_between_full_audio_playthroughs))
    final_audio = np.concatenate([sequence, silence_between] * (num_full_audio_playthroughs - 1) + [sequence])
    
    # Normalize
    final_audio = np.int16(final_audio / np.max(np.abs(final_audio)) * 32767)
    print(final_audio.max(), final_audio.min())
    print(final_audio)

    # Save to WAV file
    os.makedirs("./sounds", exist_ok=True)
    filepath = f"./sounds/{filename}"
    write(filepath, sample_rate, final_audio)
    print("WAV file '" + filepath + "' created successfully!")

if __name__ == "__main__":
    generate_v1_pathogen_sound()