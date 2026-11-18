export const duration = 36.377;
export const music = {
  title: "MONTAGEM TOMADA (Slowed)",
  audio: 'productions/short_montagem_tomada_slowed/audio.mp3',
  beats: 'productions/short_montagem_tomada_slowed/audio.json',
  spectrogram: {image: 'productions/short_montagem_tomada_slowed/spectrogram.png', metadata: 'productions/short_montagem_tomada_slowed/spectrogram.json'},
};

export const overlayMeta = {title: music.title, artist: "MXZI", phases: [
  {name: "Last words", t0: 0, t1: 1.121, color: '#546b87'},
  {name: "Seven strokes", t0: 1.121, t1: 15.668, color: '#a75d42'},
  {name: "Voice across the swell", t0: 15.668, t1: 17.857, color: '#527778'},
  {name: "Drum and answer", t0: 17.857, t1: 36.377, color: '#a34742'},
]};

// Measured seconds in the cut and the strength of each landing.
export const strikes: [number, number][] = [
  // Clipped words, then the upper figure
  [.302, .57], [.436, .25], [.691, .39], [1.011, .28],
  [1.121, .52], [1.4, .55], [1.672, .36], [1.945, .45], [2.218, .27], [2.491, .37], [2.903, .66],
  [3.315, .86], [3.594, .49], [3.867, .46], [4.14, .31], [4.412, .67], [4.691, .60], [5.097, .63],
  [5.51, .62], [5.788, .65], [6.061, .76], [6.34, .54], [6.612, .56], [6.885, .74], [7.297, .80],
  [7.71, .86], [7.982, .42], [8.255, .48], [8.534, .34], [8.807, .72], [9.08, .62], [9.492, .25],
  [9.904, .36], [10.183, .53], [10.455, .24], [10.728, .19], [11.001, .29], [11.28, .62], [11.686, .36],
  [12.104, .37], [12.377, .56], [12.65, .25], [12.922, .28], [13.201, .27], [13.474, .64], [13.88, .38],
  [14.292, .40], [14.571, .53], [14.844, .23], [15.117, .20], [15.395, .38],
  // The first four syllables speak out. Skim the quick tail, then take air into the drum.
  [15.668, .30], [15.982, .24], [16.22, .42], [16.533, .28], [16.771, .19],
  [16.911, .13], [17.16, .19], [17.317, .15], [17.485, .23], [17.625, .25], [17.729, .10],
  // Drum and delayed upper accent finish the bar. The next six strokes alternate stems.
  [17.857, .96], [18.275, .84],
  [18.687, .22], [18.96, .34], [19.238, .50], [19.505, .60], [19.784, .78], [20.057, .59], [20.469, .86],
  [20.881, .23], [21.154, .35], [21.433, .47], [21.7, .60], [21.978, .81], [22.251, .61], [22.663, .84],
  [23.075, .25], [23.348, .35], [23.627, .53], [23.9, .59], [24.178, .75], [24.445, .62], [24.858, .82],
  // The upper line breaks off. Leave the hole open until the drum restarts the figure.
  [25.276, .22], [25.543, .33], [26.64, .87], [27.052, .81],
  [27.47, .24], [27.737, .35], [28.021, .52], [28.288, .59], [28.567, .79], [28.84, .64],
  [29.252, .39], [29.664, .30], [30.216, .51], [30.761, .88],
  [31.075, .35], [31.446, .45], [31.858, .55], [32.41, .48], [32.956, .80],
  [33.286, .52], [33.64, .38], [34.053, .31], [34.604, .47], [34.877, .68], [35.15, .94],
  [35.707, .20], [35.98, .42], [36.253, .50],
];
