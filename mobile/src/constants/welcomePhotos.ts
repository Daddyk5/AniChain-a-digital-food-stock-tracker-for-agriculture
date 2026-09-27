/**
 * Real photos of Davao City from Wikimedia Commons. They're loaded from Wikimedia at runtime and
 * cached on the device by expo-image. CC BY-SA and CC BY require attribution, which the welcome
 * screen shows on every slide, linking to each file's Commons page (author + license details).
 */
export type WelcomePhoto = {
  uri: string;
  title: string;
  author: string;
  license: string;
  sourceUrl: string;
};

const thumb = (path: string) => `https://upload.wikimedia.org/wikipedia/commons/thumb/${path}`;

export const WELCOME_SLIDES: { photo: WelcomePhoto; heading: string; body: string; tint: string }[] = [
  {
    tint: '#3A2E0A',
    heading: 'Live prices from Davao’s markets',
    body: 'Bankerohan, Agdao and city-wide bulletins, updated the moment a price changes. No refreshing.',
    photo: {
      uri: thumb('0/01/Bankerohan_Public_Market.jpg/1280px-Bankerohan_Public_Market.jpg'),
      title: 'Bankerohan Public Market',
      author: 'PAULIX04',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Bankerohan_Public_Market.jpg',
    },
  },
  {
    tint: '#123326',
    heading: 'From durian to galunggong',
    body: 'Meat, fish, eggs, vegetables and fruits, all in one exchange-style ticker.',
    photo: {
      uri: thumb('a/ad/Fresh_Durian_Fruits_Stacked_at_Davao_city.jpg/1280px-Fresh_Durian_Fruits_Stacked_at_Davao_city.jpg'),
      title: 'Fresh durian fruits stacked at Davao City',
      author: 'PAULIX04',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Fresh_Durian_Fruits_Stacked_at_Davao_city.jpg',
    },
  },
  {
    tint: '#3A1A1E',
    heading: 'Watch what you buy',
    body: 'Star a commodity and get an alert the moment its price moves, with an AI summary of the trend.',
    photo: {
      uri: thumb(
        '0/08/Agdao_Public_Market_%28Lapu-Lapu_Street%2C_Agdao%2C_Davao_City%3B_08-21-2023%29.jpg/1280px-Agdao_Public_Market_%28Lapu-Lapu_Street%2C_Agdao%2C_Davao_City%3B_08-21-2023%29.jpg',
      ),
      title: 'Agdao Public Market, Lapu-Lapu Street',
      author: 'Patrickroque01',
      license: 'Public domain',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Agdao_Public_Market_(Lapu-Lapu_Street,_Agdao,_Davao_City;_08-21-2023).jpg',
    },
  },
  {
    tint: '#132A3A',
    heading: 'Made for Davao',
    body: 'Prices for the city’s own markets, in pesos, as they happen.',
    photo: {
      uri: thumb('9/93/Davao_City_skyline_01.jpg/1280px-Davao_City_skyline_01.jpg'),
      title: 'Davao City skyline',
      author: 'Teemu Väisänen',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Davao_City_skyline_01.jpg',
    },
  },
];
