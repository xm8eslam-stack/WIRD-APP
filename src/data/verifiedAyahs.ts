import { Ayah } from '../types/quran';

export const VERIFIED_AYAHS: Record<number, Ayah[]> = {
  // Surah 1: Al-Fatihah (1-7)
  1: [
    { number: 1, numberInSurah: 1, surahNumber: 1, juz: 1, page: 1, text: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ" },
    { number: 2, numberInSurah: 2, surahNumber: 1, juz: 1, page: 1, text: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ" },
    { number: 3, numberInSurah: 3, surahNumber: 1, juz: 1, page: 1, text: "الرَّحْمَٰنِ الرَّحِيمِ" },
    { number: 4, numberInSurah: 4, surahNumber: 1, juz: 1, page: 1, text: "مَالِكِ يَوْمِ الدِّينِ" },
    { number: 5, numberInSurah: 5, surahNumber: 1, juz: 1, page: 1, text: "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ" },
    { number: 6, numberInSurah: 6, surahNumber: 1, juz: 1, page: 1, text: "اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ" },
    { number: 7, numberInSurah: 7, surahNumber: 1, juz: 1, page: 1, text: "صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ" }
  ],

  // Surah 2: Selected key memorization passages (1-5, 255 Ayat Al-Kursi, 285-286)
  2: [
    { number: 8, numberInSurah: 1, surahNumber: 2, juz: 1, page: 2, text: "الم" },
    { number: 9, numberInSurah: 2, surahNumber: 2, juz: 1, page: 2, text: "ذَٰلِكَ الْكِتَابُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى لِّلْمُتَّقِينَ" },
    { number: 10, numberInSurah: 3, surahNumber: 2, juz: 1, page: 2, text: "الَّذِينَ يُؤْمِنُونَ بِالْغَيْبِ وَيُقِيمُونَ الصَّلَاةَ وَمِمَّا رَزَقْنَاهُمْ يُنفِقُونَ" },
    { number: 11, numberInSurah: 4, surahNumber: 2, juz: 1, page: 2, text: "وَالَّذِينَ يُؤْمِنُونَ بِمَا أُنزِلَ إِلَيْكَ وَمَا أُنزِلَ مِن قَبْلِكَ وَبِالْآخِرَةِ هُمْ يُوقِنُونَ" },
    { number: 12, numberInSurah: 5, surahNumber: 2, juz: 1, page: 2, text: "أُولَٰئِكَ عَلَىٰ هُدًى مِّن رَّبِّهِمْ ۖ وَأُولَٰئِكَ هُمُ الْمُفْلِحُونَ" },
    { number: 262, numberInSurah: 255, surahNumber: 2, juz: 3, page: 42, text: "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَن ذَا الَّذِي يَشْفَعُ عِندَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ" },
    { number: 292, numberInSurah: 285, surahNumber: 2, juz: 3, page: 49, text: "آمَنَ الرَّسُولُ بِمَا أُنزِلَ إِلَيْهِ مِن رَّبِّهِ وَالْمُؤْمِنُونَ ۚ كُلٌّ آمَنَ بِاللَّهِ وَمَلَائِكَتِهِ وَكُتُبِهِ وَرُسُلِهِ لَا نُفَرِّقُ بَيْنَ أَحَدٍ مِّن رُّسُلِهِ ۚ وَقَالُوا سَمِعْنَا وَأَطَعْنَا ۖ غُفْرَانَكَ رَبَّنَا وَإِلَيْكَ الْمَصِيرُ" },
    { number: 293, numberInSurah: 286, surahNumber: 2, juz: 3, page: 49, text: "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا ۚ لَهَا مَا كَسَبَتْ وَعَلَيْهَا مَا اكْتَسَبَتْ ۗ رَبَّنَا لَا تُؤَاخِذْنَا إِن نَّسِينَا أَوْ أَخْطَأْنَا ۚ رَبَّنَا وَلَا تَحْمِلْ عَلَيْنَا إِصْرًا كَمَا حَمَلْتَهُ عَلَى الَّذِينَ مِن قَبْلِنَا ۚ رَبَّنَا وَلَا تُحَمِّلْنَا مَا لَا طَاقَةَ لَنَا بِهِ ۖ وَاعْفُ عَنَّا وَاغْفِرْ لَنَا وَارْحَمْنَا ۚ أَنتَ مَوْلَانَا فَانصُرْنَا عَلَى الْقَوْمِ الْكَافِرِينَ" }
  ],

  // Surah 18: Al-Kahf (1-10)
  18: [
    { number: 2141, numberInSurah: 1, surahNumber: 18, juz: 15, page: 293, text: "الْحَمْدُ لِلَّهِ الَّذِي أَنزَلَ عَلَىٰ عَبْدِهِ الْكِتَابَ وَلَمْ يَجْعَل لَّهُ عِوَجًا" },
    { number: 2142, numberInSurah: 2, surahNumber: 18, juz: 15, page: 293, text: "قَيِّمًا لِّيُنذِرَ بَأْسًا شَدِيدًا مِّن لَّدُنْهُ وَيُبَشِّرَ الْمُؤْمِنِينَ الَّذِينَ يَعْمَلُونَ الصَّالِحَاتِ أَنَّ لَهُمْ أَجْرًا حَسَنًا" },
    { number: 2143, numberInSurah: 3, surahNumber: 18, juz: 15, page: 293, text: "مَّاكِثِينَ فِيهِ أَبَدًا" },
    { number: 2144, numberInSurah: 4, surahNumber: 18, juz: 15, page: 293, text: "وَيُنذِرَ الَّذِينَ قَالُوا اتَّخَذَ اللَّهُ وَلَدًا" },
    { number: 2145, numberInSurah: 5, surahNumber: 18, juz: 15, page: 293, text: "مَّا لَهُم بِهِ مِنْ عِلْمٍ وَلَا لِآبَائِهِمْ ۚ كَبُرَتْ كَلِمَةً تَخْرُجُ مِنْ أَفْوَاهِهِمْ ۚ إِن يَقُولُونَ إِلَّا كَذِبًا" },
    { number: 2146, numberInSurah: 6, surahNumber: 18, juz: 15, page: 293, text: "فَلَعَلَّكَ بَاخِعٌ نَّفْسَكَ عَلَىٰ آثَارِهِمْ إِن لَّمْ يُؤْمِنُوا بِهَٰذَا الْحَدِيثِ أَسَفًا" },
    { number: 2147, numberInSurah: 7, surahNumber: 18, juz: 15, page: 294, text: "إِنَّا جَعَلْنَا مَا عَلَى الْأَرْضِ زِينَةً لَّهَا لِنَبْلُوَهُمْ أَيُّهُمْ أَحْسَنُ عَمَلًا" },
    { number: 2148, numberInSurah: 8, surahNumber: 18, juz: 15, page: 294, text: "وَإِنَّا لَجَاعِلُونَ مَا عَلَيْهَا صَعِيدًا جُرُزًا" },
    { number: 2149, numberInSurah: 9, surahNumber: 18, juz: 15, page: 294, text: "أَمْ حَسِبْتَ أَنَّ أَصْحَابَ الْكَهْفِ وَالرَّقِيمِ كَانُوا مِنْ آيَاتِنَا عَجَبًا" },
    { number: 2150, numberInSurah: 10, surahNumber: 18, juz: 15, page: 294, text: "إِذْ أَوَى الْفِتْيَةُ إِلَى الْكَهْفِ فَقَالُوا رَبَّنَا آتِنَا مِن لَّدُنكَ رَحْمَةً وَهَيِّئْ لَنَا مِنْ أَمْرِنَا رَشَدًا" }
  ],

  // Surah 67: Al-Mulk (Complete 1-30)
  67: [
    { number: 5242, numberInSurah: 1, surahNumber: 67, juz: 29, page: 562, text: "تَبَارَكَ الَّذِي بِيَدِهِ الْمُلْكُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ" },
    { number: 5243, numberInSurah: 2, surahNumber: 67, juz: 29, page: 562, text: "الَّذِي خَلَقَ الْمَوْتَ وَالْحَيَاةَ لِيَبْلُوَكُمْ أَيُّكُمْ أَحْسَنُ عَمَلًا ۚ وَهُوَ الْعَزِيزُ الْغَفُورُ" },
    { number: 5244, numberInSurah: 3, surahNumber: 67, juz: 29, page: 562, text: "الَّذِي خَلَقَ سَبْعَ سَمَاوَاتٍ طِبَاقًا ۖ مَّا تَرَىٰ فِي خَلْقِ الرَّحْمَٰنِ مِن تَفَاوُتٍ ۖ فَارْجِعِ الْبَصَرَ هَلْ تَرَىٰ مِن فُطُورٍ" },
    { number: 5245, numberInSurah: 4, surahNumber: 67, juz: 29, page: 562, text: "ثُمَّ ارْجِعِ الْبَصَرَ كَرَّتَيْنِ يَنقَلِبْ إِلَيْكَ الْبَصَرُ خَاسِئًا وَهُوَ حَسِيرٌ" },
    { number: 5246, numberInSurah: 5, surahNumber: 67, juz: 29, page: 562, text: "وَلَقَدْ زَيَّنَّا السَّمَاءَ الدُّنْيَا بِمَصَابِيحَ وَجَعَلْنَاهَا رُجُومًا لِّلشَّيَاطِينِ ۖ وَأَعْتَدْنَا لَهُمْ عَذَابَ السَّعِيرِ" },
    { number: 5247, numberInSurah: 6, surahNumber: 67, juz: 29, page: 562, text: "وَلِلَّذِينَ كَفَرُوا بِرَبِّهِمْ عَذَابُ جَهَنَّمَ ۖ وَبِئْسَ الْمَصِيرُ" },
    { number: 5248, numberInSurah: 7, surahNumber: 67, juz: 29, page: 562, text: "إِذَا أُلْقُوا فِيهَا سَمِعُوا لَهَا شَهِيقًا وَهِيَ تَفُورُ" },
    { number: 5249, numberInSurah: 8, surahNumber: 67, juz: 29, page: 562, text: "تَكَادُ تَمَيَّزُ مِنَ الْغَيْظِ ۖ كُلَّمَا أُلْقِيَ فِيهَا فَوْجٌ سَأَلَهُمْ خَزَنَتُهَا أَلَمْ يَأْتِكُمْ نَذِيرٌ" },
    { number: 5250, numberInSurah: 9, surahNumber: 67, juz: 29, page: 562, text: "قَالُوا بَلَىٰ قَدْ جَاءَنَا نَذِيرٌ فَكَذَّبْنَا وَقُلْنَا مَا نَزَّلَ اللَّهُ مِن شَيْءٍ إِنْ أَنتُمْ إِلَّا فِي ضَلَالٍ كَبِيرٍ" },
    { number: 5251, numberInSurah: 10, surahNumber: 67, juz: 29, page: 562, text: "وَقَالُوا لَوْ كُنَّا نَسْمَعُ أَوْ نَعْقِلُ مَا كُنَّا فِي أَصْحَابِ السَّعِيرِ" },
    { number: 5252, numberInSurah: 11, surahNumber: 67, juz: 29, page: 563, text: "فَاعْتَرَفُوا بِذَنبِهِمْ فَسُحْقًا لِّأَصْحَابِ السَّعِيرِ" },
    { number: 5253, numberInSurah: 12, surahNumber: 67, juz: 29, page: 563, text: "إِنَّ الَّذِينَ يَخْشَوْنَ رَبَّهُم بِالْغَيْبِ لَهُم مَّغْفِرَةٌ وَأَجْرٌ كَبِيرٌ" },
    { number: 5254, numberInSurah: 13, surahNumber: 67, juz: 29, page: 563, text: "وَأَسِرُّوا قَوْلَكُمْ أَوِ اجْهَرُوا بِهِ ۖ إِنَّهُ عَلِيمٌ بِذَاتِ الصُّدُورِ" },
    { number: 5255, numberInSurah: 14, surahNumber: 67, juz: 29, page: 563, text: "أَلَا يَعْلَمُ مَنْ خَلَقَ وَهُوَ اللَّطِيفُ الْخَبِيرُ" },
    { number: 5256, numberInSurah: 15, surahNumber: 67, juz: 29, page: 563, text: "هُوَ الَّذِي جَعَلَ لَكُمُ الْأَرْضَ ذَلُولًا فَامْشُوا فِي مَنَاكِبِهَا وَكُلُوا مِن رِّزْقِهِ ۖ وَإِلَيْهِ النُّشُورُ" },
    { number: 5257, numberInSurah: 16, surahNumber: 67, juz: 29, page: 563, text: "أَأَمِنتُم مَّن فِي السَّمَاءِ أَن يَخْسِفَ بِكُمُ الْأَرْضَ فَإِذَا هِيَ تَمُورُ" },
    { number: 5258, numberInSurah: 17, surahNumber: 67, juz: 29, page: 563, text: "أَمْ أَمِنتُم مَّن فِي السَّمَاءِ أَن يُرْسِلَ عَلَيْكُمْ حَاصِبًا ۖ فَسَتَعْلَمُونَ كَيْفَ نَذِيرِ" },
    { number: 5259, numberInSurah: 18, surahNumber: 67, juz: 29, page: 563, text: "وَلَقَدْ كَذَّبَ الَّذِينَ مِن قَبْلِهِمْ فَكَيْفَ كَانَ نَكِيرِ" },
    { number: 5260, numberInSurah: 19, surahNumber: 67, juz: 29, page: 563, text: "أَوَلَمْ يَرَوْا إِلَى الطَّيْرِ فَوْقَهُمْ صَافَّاتٍ وَيَقْبِضْنَ ۚ مَا يُمْسِكُهُنَّ إِلَّا الرَّحْمَٰنُ ۚ إِنَّهُ بِكُلِّ شَيْءٍ بَصِيرٌ" },
    { number: 5261, numberInSurah: 20, surahNumber: 67, juz: 29, page: 563, text: "أَمَّنْ هَٰذَا الَّذِي هُوَ جُندٌ لَّكُمْ يَنصُرُكُم مِّن دُونِ الرَّحْمَٰنِ ۚ إِنِ الْكَافِرُونَ إِلَّا فِي غُرُورٍ" },
    { number: 5262, numberInSurah: 21, surahNumber: 67, juz: 29, page: 564, text: "أَمَّنْ هَٰذَا الَّذِي يَرْزُقُكُمْ إِنْ أَمْسَكَ رِزْقَهُ ۚ بَل لَّجُّوا فِي عُتُوٍّ وَنُفُورٍ" },
    { number: 5263, numberInSurah: 22, surahNumber: 67, juz: 29, page: 564, text: "أَفَمَن يَمْشِي مُكِبًّا عَلَىٰ وَجْهِهِ أَهْدَىٰ أَمَّن يَمْشِي سَوِيًّا عَلَىٰ صِرَاطٍ مُّسْتَقِيمٍ" },
    { number: 5264, numberInSurah: 23, surahNumber: 67, juz: 29, page: 564, text: "قُلْ هُوَ الَّذِي أَنشَأَكُمْ وَجَعَلَ لَكُمُ السَّمْعَ وَالْأَبْصَارَ وَالْأَفْئِدَةَ ۖ قَلِيلًا مَّا تَشْكُرُونَ" },
    { number: 5265, numberInSurah: 24, surahNumber: 67, juz: 29, page: 564, text: "قُلْ هُوَ الَّذِي ذَرَأَكُمْ فِي الْأَرْضِ وَإِلَيْهِ تُحْشَرُونَ" },
    { number: 5266, numberInSurah: 25, surahNumber: 67, juz: 29, page: 564, text: "وَيَقُولُونَ مَتَىٰ هَٰذَا الْوَعْدُ إِن كُنتُمْ صَادِقِينَ" },
    { number: 5267, numberInSurah: 26, surahNumber: 67, juz: 29, page: 564, text: "قُلْ إِنَّمَا الْعِلْمُ عِندَ اللَّهِ وَإِنَّمَا أَنَا نَذِيرٌ مُّبِينٌ" },
    { number: 5268, numberInSurah: 27, surahNumber: 67, juz: 29, page: 564, text: "فَلَمَّا رَأَوْهُ زُلْفَةً سِيئَتْ وُجُوهُ الَّذِينَ كَفَرُوا وَقِيلَ هَٰذَا الَّذِي كُنتُم بِهِ تَدَّعُونَ" },
    { number: 5269, numberInSurah: 28, surahNumber: 67, juz: 29, page: 564, text: "قُلْ أَرَأَيْتُمْ إِنْ أَهْلَكَنِيَ اللَّهُ وَمَن مَّعِيَ أَوْ رَحِمَنَا فَمَن يُجِيرُ الْكَافِرِينَ مِنْ عَذَابٍ أَلِيمٍ" },
    { number: 5270, numberInSurah: 29, surahNumber: 67, juz: 29, page: 564, text: "قُلْ هُوَ الرَّحْمَٰنُ آمَنَّا بِهِ وَعَلَيْهِ تَوَكَّلْنَا ۖ فَسَتَعْلَمُونَ مَنْ هُوَ فِي ضَلَالٍ مُّبِينٍ" },
    { number: 5271, numberInSurah: 30, surahNumber: 67, juz: 29, page: 564, text: "قُلْ أَرَأَيْتُمْ إِنْ أَصْبَحَ مَاؤُكُمْ غَوْرًا فَمَن يَأْتِيكُم بِمَاءٍ مَّعِينٍ" }
  ],

  // Surah 78: An-Naba (1-16)
  78: [
    { number: 5673, numberInSurah: 1, surahNumber: 78, juz: 30, page: 582, text: "عَمَّ يَتَسَاءَلُونَ" },
    { number: 5674, numberInSurah: 2, surahNumber: 78, juz: 30, page: 582, text: "عَنِ النَّبَإِ الْعَظِيمِ" },
    { number: 5675, numberInSurah: 3, surahNumber: 78, juz: 30, page: 582, text: "الَّذِي هُمْ فِيهِ مُخْتَلِفُونَ" },
    { number: 5676, numberInSurah: 4, surahNumber: 78, juz: 30, page: 582, text: "كَلَّا سَيَعْلَمُونَ" },
    { number: 5677, numberInSurah: 5, surahNumber: 78, juz: 30, page: 582, text: "ثُمَّ كَلَّا سَيَعْلَمُونَ" },
    { number: 5678, numberInSurah: 6, surahNumber: 78, juz: 30, page: 582, text: "أَلَمْ نَجْعَلِ الْأَرْضَ مِهَادًا" },
    { number: 5679, numberInSurah: 7, surahNumber: 78, juz: 30, page: 582, text: "وَالْجِبَالَ أَوْتَادًا" },
    { number: 5680, numberInSurah: 8, surahNumber: 78, juz: 30, page: 582, text: "وَخَلَقْنَاكُمْ أَزْوَاجًا" },
    { number: 5681, numberInSurah: 9, surahNumber: 78, juz: 30, page: 582, text: "وَجَعَلْنَا نَوْمَكُمْ سُبَاتًا" },
    { number: 5682, numberInSurah: 10, surahNumber: 78, juz: 30, page: 582, text: "وَجَعَلْنَا اللَّيْلَ لِبَاسًا" },
    { number: 5683, numberInSurah: 11, surahNumber: 78, juz: 30, page: 582, text: "وَجَعَلْنَا النَّهَارَ مَعَاشًا" },
    { number: 5684, numberInSurah: 12, surahNumber: 78, juz: 30, page: 582, text: "وَبَنَيْنَا فَوْقَكُمْ سَبْعًا شِدَادًا" },
    { number: 5685, numberInSurah: 13, surahNumber: 78, juz: 30, page: 582, text: "وَجَعَلْنَا سِرَاجًا وَهَّاجًا" },
    { number: 5686, numberInSurah: 14, surahNumber: 78, juz: 30, page: 582, text: "وَأَنزَلْنَا مِنَ الْمُعْصِرَاتِ مَاءً ثَجَّاجًا" },
    { number: 5687, numberInSurah: 15, surahNumber: 78, juz: 30, page: 582, text: "لِّنُخْرِجَ بِهِ حَبًّا وَنَبَاتًا" },
    { number: 5688, numberInSurah: 16, surahNumber: 78, juz: 30, page: 582, text: "وَجَنَّاتٍ أَلْفَافًا" }
  ],

  // Surah 93: Ad-Duha
  93: [
    { number: 6081, numberInSurah: 1, surahNumber: 93, juz: 30, page: 596, text: "وَالضُّحَىٰ" },
    { number: 6082, numberInSurah: 2, surahNumber: 93, juz: 30, page: 596, text: "وَاللَّيْلِ إِذَا سَجَىٰ" },
    { number: 6083, numberInSurah: 3, surahNumber: 93, juz: 30, page: 596, text: "مَا وَدَّعَكَ رَبُّكَ وَمَا قَلَىٰ" },
    { number: 6084, numberInSurah: 4, surahNumber: 93, juz: 30, page: 596, text: "وَلَلْآخِرَةُ خَيْرٌ لَّكَ مِنَ الْأُولَىٰ" },
    { number: 6085, numberInSurah: 5, surahNumber: 93, juz: 30, page: 596, text: "وَلَسَوْفَ يُعْطِيكَ رَبُّكَ فَتَرْضَىٰ" },
    { number: 6086, numberInSurah: 6, surahNumber: 93, juz: 30, page: 596, text: "أَلَمْ يَجِدْكَ يَتِيمًا فَآوَىٰ" },
    { number: 6087, numberInSurah: 7, surahNumber: 93, juz: 30, page: 596, text: "وَوَجَدَكَ ضَالًّا فَهَدَىٰ" },
    { number: 6088, numberInSurah: 8, surahNumber: 93, juz: 30, page: 596, text: "وَوَجَدَكَ عَائِلًا فَأَغْنَىٰ" },
    { number: 6089, numberInSurah: 9, surahNumber: 93, juz: 30, page: 596, text: "فَأَمَّا الْيَتِيمَ فَلَا تَقْهَرْ" },
    { number: 6090, numberInSurah: 10, surahNumber: 93, juz: 30, page: 596, text: "وَأَمَّا السَّائِلَ فَلَا تَنْهَرْ" },
    { number: 6091, numberInSurah: 11, surahNumber: 93, juz: 30, page: 596, text: "وَأَمَّا بِنِعْمَةِ رَبِّكَ فَحَدِّثْ" }
  ],

  // Surah 94: Ash-Sharh
  94: [
    { number: 6092, numberInSurah: 1, surahNumber: 94, juz: 30, page: 596, text: "أَلَمْ نَشْرَحْ لَكَ صَدْرَكَ" },
    { number: 6093, numberInSurah: 2, surahNumber: 94, juz: 30, page: 596, text: "وَوَضَعْنَا عَنكَ وِزْرَكَ" },
    { number: 6094, numberInSurah: 3, surahNumber: 94, juz: 30, page: 596, text: "الَّذِي أَنقَضَ ظَهْرَكَ" },
    { number: 6095, numberInSurah: 4, surahNumber: 94, juz: 30, page: 596, text: "وَرَفَعْنَا لَكَ ذِكْرَكَ" },
    { number: 6096, numberInSurah: 5, surahNumber: 94, juz: 30, page: 596, text: "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا" },
    { number: 6097, numberInSurah: 6, surahNumber: 94, juz: 30, page: 596, text: "إِنَّ مَعَ الْعُسْرِ يُسْرًا" },
    { number: 6098, numberInSurah: 7, surahNumber: 94, juz: 30, page: 596, text: "فَإِذَا فَرَغْتَ فَانصَبْ" },
    { number: 6099, numberInSurah: 8, surahNumber: 94, juz: 30, page: 596, text: "وَإِلَىٰ رَبِّكَ فَارْغَب" }
  ],

  // Surah 95: At-Tin
  95: [
    { number: 6100, numberInSurah: 1, surahNumber: 95, juz: 30, page: 597, text: "وَالتِّينِ وَالزَّيْتُونِ" },
    { number: 6101, numberInSurah: 2, surahNumber: 95, juz: 30, page: 597, text: "وَطُورِ سِينِينَ" },
    { number: 6102, numberInSurah: 3, surahNumber: 95, juz: 30, page: 597, text: "وَهَٰذَا الْبَلَدِ الْأَمِينِ" },
    { number: 6103, numberInSurah: 4, surahNumber: 95, juz: 30, page: 597, text: "لَقَدْ خَلَقْنَا الْإِنسَانَ فِي أَحْسَنِ تَقْوِيمٍ" },
    { number: 6104, numberInSurah: 5, surahNumber: 95, juz: 30, page: 597, text: "ثُمَّ رَدَدْنَاهُ أَسْفَلَ سَافِلِينَ" },
    { number: 6105, numberInSurah: 6, surahNumber: 95, juz: 30, page: 597, text: "إِلَّا الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ فَلَهُمْ أَجْرٌ غَيْرُ مَمْنُونٍ" },
    { number: 6106, numberInSurah: 7, surahNumber: 95, juz: 30, page: 597, text: "فَمَا يُكَذِّبُكَ بَعْدُ بِالدِّينِ" },
    { number: 6107, numberInSurah: 8, surahNumber: 95, juz: 30, page: 597, text: "أَلَيْسَ اللَّهُ بِأَحْكَمِ الْحَاكِمِينَ" }
  ],

  // Surah 97: Al-Qadr
  97: [
    { number: 6126, numberInSurah: 1, surahNumber: 97, juz: 30, page: 598, text: "إِنَّا أَنزَلْنَاهُ فِي لَيْلَةِ الْقَدْرِ" },
    { number: 6127, numberInSurah: 2, surahNumber: 97, juz: 30, page: 598, text: "وَمَا أَدْرَاكَ مَا لَيْلَةُ الْقَدْرِ" },
    { number: 6128, numberInSurah: 3, surahNumber: 97, juz: 30, page: 598, text: "لَيْلَةُ الْقَدْرِ خَيْرٌ مِّنْ أَلْفِ شَهْرٍ" },
    { number: 6129, numberInSurah: 4, surahNumber: 97, juz: 30, page: 598, text: "تَنَزَّلُ الْمَلَائِكَةُ وَالرُّوحُ فِيهَا بِإِذْنِ رَبِّهِم مِّن كُلِّ أَمْرٍ" },
    { number: 6130, numberInSurah: 5, surahNumber: 97, juz: 30, page: 598, text: "سَلَامٌ هِيَ حَتَّىٰ مَطْلَعِ الْفَجْرِ" }
  ],

  // Surah 103: Al-Asr
  103: [
    { number: 6177, numberInSurah: 1, surahNumber: 103, juz: 30, page: 601, text: "وَالْعَصْرِ" },
    { number: 6178, numberInSurah: 2, surahNumber: 103, juz: 30, page: 601, text: "إِنَّ الْإِنسَانَ لَفِي خُسْرٍ" },
    { number: 6179, numberInSurah: 3, surahNumber: 103, juz: 30, page: 601, text: "إِلَّا الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ وَتَوَاصَوْا بِالْحَقِّ وَتَوَاصَوْا بِالصَّبْرِ" }
  ],

  // Surah 108: Al-Kawthar
  108: [
    { number: 6194, numberInSurah: 1, surahNumber: 108, juz: 30, page: 602, text: "إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ" },
    { number: 6195, numberInSurah: 2, surahNumber: 108, juz: 30, page: 602, text: "فَصَلِّ لِرَبِّكَ وَانْحَرْ" },
    { number: 6196, numberInSurah: 3, surahNumber: 108, juz: 30, page: 602, text: "إِنَّ شَانِئَكَ هُوَ الْأَبْتَرُ" }
  ],

  // Surah 109: Al-Kafirun
  109: [
    { number: 6197, numberInSurah: 1, surahNumber: 109, juz: 30, page: 603, text: "قُلْ يَا أَيُّهَا الْكَافِرُونَ" },
    { number: 6198, numberInSurah: 2, surahNumber: 109, juz: 30, page: 603, text: "لَا أَعْبُدُ مَا تَعْبُدُونَ" },
    { number: 6199, numberInSurah: 3, surahNumber: 109, juz: 30, page: 603, text: "وَلَا أَنتُمْ عَابِدُونَ مَا أَعْبُدُ" },
    { number: 6200, numberInSurah: 4, surahNumber: 109, juz: 30, page: 603, text: "وَلَا أَنَا عَابِدٌ مَّا عَبَدتُّمْ" },
    { number: 6201, numberInSurah: 5, surahNumber: 109, juz: 30, page: 603, text: "وَلَا أَنتُمْ عَابِدُونَ مَا أَعْبُدُ" },
    { number: 6202, numberInSurah: 6, surahNumber: 109, juz: 30, page: 603, text: "لَكُمْ دِينُكُمْ وَلِيَ دِينِ" }
  ],

  // Surah 110: An-Nasr
  110: [
    { number: 6203, numberInSurah: 1, surahNumber: 110, juz: 30, page: 603, text: "إِذَا جَاءَ نَصْرُ اللَّهِ وَالْفَتْحُ" },
    { number: 6204, numberInSurah: 2, surahNumber: 110, juz: 30, page: 603, text: "وَرَأَيْتَ النَّاسَ يَدْخُلُونَ فِي دِينِ اللَّهِ أَفْوَاجًا" },
    { number: 6205, numberInSurah: 3, surahNumber: 110, juz: 30, page: 603, text: "فَسَبِّحْ بِحَمْدِ رَبِّكَ وَاسْتَغْفِرْهُ ۚ إِنَّهُ كَانَ تَوَّابًا" }
  ],

  // Surah 111: Al-Masad
  111: [
    { number: 6206, numberInSurah: 1, surahNumber: 111, juz: 30, page: 603, text: "تَبَّتْ يَدَا أَبِي لَهَبٍ وَتَبَّ" },
    { number: 6207, numberInSurah: 2, surahNumber: 111, juz: 30, page: 603, text: "مَا أَغْنَىٰ عَنْهُ مَالُهُ وَمَا كَسَبَ" },
    { number: 6208, numberInSurah: 3, surahNumber: 111, juz: 30, page: 603, text: "سَيَصْلَىٰ نَارًا ذَاتَ لَهَبٍ" },
    { number: 6209, numberInSurah: 4, surahNumber: 111, juz: 30, page: 603, text: "وَامْرَأَتُهُ حَمَّالَةَ الْحَطَبِ" },
    { number: 6210, numberInSurah: 5, surahNumber: 111, juz: 30, page: 603, text: "فِي جِيدِهَا حَبْلٌ مِّن مَّسَدٍ" }
  ],

  // Surah 112: Al-Ikhlas
  112: [
    { number: 6211, numberInSurah: 1, surahNumber: 112, juz: 30, page: 604, text: "قُلْ هُوَ اللَّهُ أَحَدٌ" },
    { number: 6212, numberInSurah: 2, surahNumber: 112, juz: 30, page: 604, text: "اللَّهُ الصَّمَدُ" },
    { number: 6213, numberInSurah: 3, surahNumber: 112, juz: 30, page: 604, text: "لَمْ يَلِدْ وَلَمْ يُولَدْ" },
    { number: 6214, numberInSurah: 4, surahNumber: 112, juz: 30, page: 604, text: "وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ" }
  ],

  // Surah 113: Al-Falaq
  113: [
    { number: 6215, numberInSurah: 1, surahNumber: 113, juz: 30, page: 604, text: "قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ" },
    { number: 6216, numberInSurah: 2, surahNumber: 113, juz: 30, page: 604, text: "مِن شَرِّ مَا خَلَقَ" },
    { number: 6217, numberInSurah: 3, surahNumber: 113, juz: 30, page: 604, text: "وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ" },
    { number: 6218, numberInSurah: 4, surahNumber: 113, juz: 30, page: 604, text: "وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ" },
    { number: 6219, numberInSurah: 5, surahNumber: 113, juz: 30, page: 604, text: "وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ" }
  ],

  // Surah 114: An-Nas
  114: [
    { number: 6220, numberInSurah: 1, surahNumber: 114, juz: 30, page: 604, text: "قُلْ أَعُوذُ بِرَبِّ النَّاسِ" },
    { number: 6221, numberInSurah: 2, surahNumber: 114, juz: 30, page: 604, text: "مَلِكِ النَّاسِ" },
    { number: 6222, numberInSurah: 3, surahNumber: 114, juz: 30, page: 604, text: "إِلَٰهِ النَّاسِ" },
    { number: 6223, numberInSurah: 4, surahNumber: 114, juz: 30, page: 604, text: "مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ" },
    { number: 6224, numberInSurah: 5, surahNumber: 114, juz: 30, page: 604, text: "الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ" },
    { number: 6225, numberInSurah: 6, surahNumber: 114, juz: 30, page: 604, text: "مِنَ الْجِنَّةِ وَالنَّاسِ" }
  ]
};

// Helper to get verses for any surah
export function getSurahVerses(surahNumber: number): Ayah[] {
  return VERIFIED_AYAHS[surahNumber] || [];
}

// Split ayah into words safely, preserving meaning
export function getAyahWords(text: string): string[] {
  return text.split(/\s+/).filter(w => w.trim().length > 0 && w !== 'ۚ' && w !== 'ۖ' && w !== 'ۗ' && w !== 'ۛ');
}
