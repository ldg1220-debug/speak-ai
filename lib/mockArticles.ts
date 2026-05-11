export interface Article {
  id: string;
  category: string;
  region: string;
  source: string;
  level: string;
  title: string;
  url: string;
  summaryEn: string;
  summaryKo: string;
  openingQuestion: string;
  vocabulary: [string, string, string, string][];
}

export const MOCK_ARTICLES: Article[] = [
  {
    id: "markets-rate",
    category: "business",
    region: "world",
    source: "Global Brief",
    level: "Intermediate",
    title: "Global markets react to the latest interest rate decision",
    url: "#",
    summaryEn:
      "Global markets moved cautiously after central bank officials signaled that interest rates may stay higher for longer. Investors are watching inflation data, company earnings, and consumer spending to understand whether the economy can keep growing without renewed price pressure.",
    summaryKo:
      "중앙은행 관계자들이 금리가 더 오래 높은 수준을 유지할 수 있다고 시사하자 세계 금융시장은 조심스럽게 움직였습니다.",
    openingQuestion: "What do you think higher interest rates mean for ordinary people?",
    vocabulary: [
      ["interest rate", "금리", "noun", "Higher interest rates can slow borrowing."],
      ["inflation", "인플레이션", "noun", "Inflation affects the price of everyday goods."],
      ["investor", "투자자", "noun", "Investors reacted carefully to the announcement."],
      ["consumer spending", "소비 지출", "noun", "Consumer spending is a key economic signal."],
      ["earnings", "기업 실적", "noun", "Company earnings were stronger than expected."],
      ["cautiously", "조심스럽게", "adverb", "Markets moved cautiously after the news."],
      ["pressure", "압박", "noun", "Price pressure remains a concern."],
      ["forecast", "전망하다", "verb", "Analysts forecast slower growth next quarter."],
    ],
  },
  {
    id: "korea-startups",
    category: "korea",
    region: "korea",
    source: "Korea Daily Brief",
    level: "Upper Beginner",
    title: "Korean startups expand hiring in AI and battery sectors",
    url: "#",
    summaryEn:
      "Several Korean startups are increasing hiring in artificial intelligence, batteries, and robotics. Industry watchers say the trend reflects demand for engineers who can turn research into commercial products.",
    summaryKo:
      "국내 여러 스타트업이 인공지능, 배터리, 로봇 분야 채용을 늘리고 있습니다.",
    openingQuestion: "Which industry do you think will create more jobs in Korea?",
    vocabulary: [
      ["startup", "스타트업", "noun", "The startup is hiring more engineers."],
      ["hiring", "채용", "noun", "Hiring increased in the battery sector."],
      ["sector", "분야", "noun", "The AI sector is growing quickly."],
      ["robotics", "로봇 공학", "noun", "Robotics companies need skilled workers."],
      ["industry watcher", "업계 분석가", "noun", "Industry watchers expect strong growth."],
      ["commercial product", "상용 제품", "noun", "Research must become a commercial product."],
      ["demand", "수요", "noun", "Demand for engineers is rising."],
      ["engineer", "엔지니어", "noun", "Engineers are important for product development."],
    ],
  },
  {
    id: "entertainment-film",
    category: "entertainment",
    region: "korea",
    source: "Culture Desk",
    level: "Beginner",
    title: "Korean film draws attention ahead of international festival",
    url: "#",
    summaryEn:
      "A new Korean film is receiving attention before its international festival premiere. Critics say the movie combines a personal family story with social themes that can connect with global audiences.",
    summaryKo:
      "새로운 한국 영화가 국제 영화제 공개를 앞두고 주목받고 있습니다.",
    openingQuestion: "What kind of movies do you enjoy talking about in English?",
    vocabulary: [
      ["film", "영화", "noun", "The film will premiere at a festival."],
      ["festival", "영화제", "noun", "The festival attracts global audiences."],
      ["premiere", "첫 공개", "noun", "The premiere will take place next month."],
      ["critic", "평론가", "noun", "Critics praised the movie's story."],
      ["audience", "관객", "noun", "The audience reacted warmly."],
      ["social theme", "사회적 주제", "noun", "The movie includes a social theme."],
      ["draw attention", "주목을 끌다", "verb", "The actor's performance drew attention."],
      ["performance", "연기", "noun", "Her performance felt natural."],
    ],
  },
  {
    id: "ai-rules",
    category: "tech",
    region: "world",
    source: "Tech Policy Daily",
    level: "Upper Beginner",
    title: "New AI regulation proposal focuses on transparency",
    url: "#",
    summaryEn:
      "Lawmakers introduced a proposal that would require companies to explain how high-impact AI systems are tested and monitored. Supporters say the rules could build public trust, while critics warn that small companies may face higher compliance costs.",
    summaryKo:
      "입법자들은 영향력이 큰 AI 시스템이 어떻게 테스트되고 관리되는지 기업이 설명하도록 요구하는 규제안을 발표했습니다.",
    openingQuestion: "Do you think AI companies should explain how their systems work?",
    vocabulary: [
      ["regulation", "규제", "noun", "The new regulation focuses on transparency."],
      ["transparency", "투명성", "noun", "Transparency can increase public trust."],
      ["proposal", "제안", "noun", "The proposal was introduced this week."],
      ["monitor", "감시하다", "verb", "Companies must monitor high-impact systems."],
    ],
  },
  {
    id: "climate-cities",
    category: "world",
    region: "world",
    source: "World Desk",
    level: "Intermediate",
    title: "Cities expand heat response plans as summers grow hotter",
    url: "#",
    summaryEn:
      "Major cities are expanding cooling centers, public alerts, and neighborhood support programs as heat waves become more frequent. Officials say the plans are especially important for older residents, outdoor workers, and families without reliable air conditioning.",
    summaryKo:
      "폭염이 더 자주 발생하면서 주요 도시들은 무더위 쉼터, 공공 경보, 지역 지원 프로그램을 확대하고 있습니다.",
    openingQuestion: "How should cities protect people during extreme heat?",
    vocabulary: [
      ["heat wave", "폭염", "noun", "Heat waves are becoming more common."],
      ["cooling center", "무더위 쉼터", "noun", "Cooling centers help vulnerable residents."],
      ["public alert", "공공 경보", "noun", "Public alerts warn people about dangerous heat."],
      ["protect", "보호하다", "verb", "Cities must protect vulnerable people."],
    ],
  },
];
