// Building interior overlays: 공개자료 확인값과 모델링용 추정 배치를 분리해 표시한다.
(function attachInteriorData() {
  const data = window.CampusData || (window.CampusData = {});
  const baseNote = "정확한 도면과 실별 치수는 공개자료에서 확인되지 않아, 확인된 기능을 중심으로 한 축소 추정 평면입니다.";

  data.pilheonInterior = {
    id: "pilheon-interior",
    title: "필헌관 내부",
    subtitle: "대학원 행정실과 강의·시험실 중심 배치",
    floor: "1F / 2F",
    source: "캠퍼스 공개 조사 자료 2동 필헌관: 1층 대학원 교학팀/행정실, 203·204호, 2202~2204 시험실, 2207~2210 대기실 확인",
    note: baseNote,
    confirmed: [
      "1층 대학원 교학팀/행정실 확인",
      "203·204호 첨단 강의실 구축 공사 확인",
      "2202, 2203, 2204 시험장소 확인",
      "2207~2210 대기실·면접대기실 확인"
    ],
    zones: [
      { id: "pilheon-1f-label", label: "1F", kind: "marker", x: 8, y: 8, w: 10, h: 8 },
      { id: "pilheon-2f-label", label: "2F", kind: "marker", x: 56, y: 8, w: 10, h: 8 },
      { id: "pilheon-entry", label: "현관", kind: "entry", x: 22, y: 74, w: 14, h: 9 },
      { id: "pilheon-office", label: "대학원\n교학팀", kind: "office", x: 12, y: 45, w: 30, h: 22 },
      { id: "pilheon-1f-corridor", label: "행정 동선", kind: "corridor", x: 10, y: 28, w: 34, h: 10 },
      { id: "pilheon-203", label: "203\n첨단강의실", kind: "lecture", x: 54, y: 27, w: 18, h: 18 },
      { id: "pilheon-204", label: "204\n첨단강의실", kind: "lecture", x: 74, y: 27, w: 18, h: 18 },
      { id: "pilheon-exam", label: "2202~2204\n시험실", kind: "lecture", x: 54, y: 52, w: 24, h: 18 },
      { id: "pilheon-wait", label: "2207~2210\n대기실", kind: "support", x: 79, y: 52, w: 13, h: 18 }
    ],
    rooms: [
      { name: "대학원 교학팀", use: "1층 대학원 행정 중심" },
      { name: "203·204호", use: "첨단 강의실 구축 공사로 확인된 강의 공간" },
      { name: "2202~2204", use: "종합시험·학위취득시험 장소" },
      { name: "2207~2210", use: "대기실과 면접대기실" }
    ]
  };

  data.manwooInterior = {
    id: "manwoo-interior",
    title: "만우관 내부",
    subtitle: "B1~5F 외부 연결 통로와 라운지 중심",
    floor: "B1-5F",
    source: "캠퍼스 공개 조사 자료 3동 만우관: 지하~5층 외부 통로, 2층 카페, 3층 휴게실·3307, 3201·3202 통합강의실, 4층 강사휴게실, 5층 커뮤니티 라운지 확인",
    note: "층별 외부 출입이 특징인 오래된 강의동으로, 평면은 층별 기능을 세로 스택으로 압축했습니다.",
    confirmed: [
      "지하부터 5층까지 각 층 외부 연결 통로 언급",
      "2층 카페 그라찌에 확인",
      "3층 남학생 휴게실과 3307호 학생 라운지 확인",
      "3201·3202 통합 중형 강의실 확인",
      "4층 강사휴게실, 5층 커뮤니티 라운지 확인"
    ],
    zones: [
      { id: "manwoo-exit", label: "층별\n외부통로", kind: "entry", x: 8, y: 10, w: 14, h: 76 },
      { id: "manwoo-5f", label: "5F 커뮤니티\n라운지", kind: "lounge", x: 30, y: 10, w: 52, h: 11 },
      { id: "manwoo-4f", label: "4F 강사휴게실", kind: "support", x: 30, y: 25, w: 52, h: 11 },
      { id: "manwoo-3f-lounge", label: "3F 3307\n학생 라운지", kind: "lounge", x: 30, y: 40, w: 24, h: 12 },
      { id: "manwoo-3f-class", label: "3201·3202\n통합 강의실", kind: "lecture", x: 58, y: 40, w: 24, h: 12 },
      { id: "manwoo-2f-cafe", label: "2F 카페\n그라찌에", kind: "cafe", x: 30, y: 57, w: 28, h: 12 },
      { id: "manwoo-club", label: "학생회실·과방", kind: "office", x: 62, y: 57, w: 20, h: 12 },
      { id: "manwoo-b1", label: "B1/저층\n연결부", kind: "corridor", x: 30, y: 74, w: 52, h: 12 }
    ],
    rooms: [
      { name: "카페 그라찌에", use: "2층 학생 휴게 동선의 중심" },
      { name: "3307호", use: "기존 소극장에서 학생 라운지로 전환된 공간" },
      { name: "3201·3202", use: "통합 중형 강의실" },
      { name: "5층 커뮤니티 라운지", use: "학생행복라운지 조성 자료 반영" },
      { name: "층별 외부 통로", use: "만우관의 복잡한 동선 특징 표현" }
    ]
  };

  data.shalomInterior = {
    id: "shalom-interior",
    title: "샬롬채플관 내부",
    subtitle: "대예배실, 교목실 4106, 지하 카타콤형 공간",
    floor: "B1 / 1F",
    source: "캠퍼스 공개 조사 자료 4동 샬롬채플관: 대예배실, 1층 교목실 4106, 지하 카타콤형 공간 확인",
    note: "좌석 수와 정확한 지하 구조는 미확인이라 예배당형 큰 홀과 부속실 중심으로 표현했습니다.",
    confirmed: [
      "샬롬채플 대예배실이 학위수여식·시무예식 장소로 반복 확인",
      "교목실 위치가 1층 4106으로 확인",
      "지하 카타콤형 공간 다수 존재 언급",
      "샬롬채플관~한울관 앞 주차장 축 확인"
    ],
    zones: [
      { id: "shalom-porch", label: "전면 포치\n계단", kind: "entry", x: 38, y: 82, w: 24, h: 9 },
      { id: "shalom-narthex", label: "로비", kind: "lobby", x: 34, y: 68, w: 32, h: 10 },
      { id: "shalom-hall", label: "대예배실", kind: "hall", x: 20, y: 24, w: 60, h: 40 },
      { id: "shalom-stage", label: "강단", kind: "marker", x: 39, y: 15, w: 22, h: 8 },
      { id: "shalom-office", label: "4106\n교목실", kind: "office", x: 75, y: 66, w: 16, h: 16 },
      { id: "shalom-b1", label: "B1 카타콤형\n부속공간", kind: "support", x: 10, y: 66, w: 18, h: 18 }
    ],
    rooms: [
      { name: "대예배실", use: "채플 수업과 대형 행사 중심 공간" },
      { name: "교목실 4106", use: "1층 교목실 및 채플 시설 관련 업무" },
      { name: "지하 카타콤형 공간", use: "공개 설명 기반의 지하 부속 공간" }
    ]
  };

  data.immanuelInterior = {
    id: "immanuel-interior",
    title: "임마누엘관 내부",
    subtitle: "학생식당, 편의점, 동아리실 25개, HBS 오픈 스튜디오",
    floor: "B1-3F",
    source: "캠퍼스 공개 조사 자료 5동 임마누엘관: B1 센터, 1층 식당·편의점, 2~3층 학생자치공간, 동아리실 25개, HBS·학보사·사회봉사단 확인",
    note: "식당 면적 정보는 실제 크기 우선순위로 반영했고, 동아리실은 반복 구획으로 압축했습니다.",
    confirmed: [
      "B1F 임상심리연구센터와 취업지원센터 확인",
      "1F 학생식당, 주방 138.60㎡, 홀 521.37㎡ 확인",
      "1F 이마트24 무인 편의점 69.3㎡ 확인",
      "동아리실 25개, 학보사, 방송국, 사회봉사단 공간 개선 확인",
      "2·3층 화장실 리모델링과 HBS 오픈 스튜디오 확인"
    ],
    zones: [
      { id: "immanuel-b1", label: "B1 임상심리\n취업지원", kind: "support", x: 8, y: 78, w: 84, h: 10 },
      { id: "immanuel-dining", label: "1F 학생식당\n홀 521.37㎡", kind: "dining", x: 10, y: 55, w: 52, h: 18 },
      { id: "immanuel-kitchen", label: "주방\n138.60㎡", kind: "service", x: 63, y: 55, w: 16, h: 18 },
      { id: "immanuel-store", label: "편의점\n69.3㎡", kind: "cafe", x: 80, y: 55, w: 12, h: 18 },
      { id: "immanuel-2f", label: "2F 학보사·HBS\n오픈 스튜디오", kind: "studio", x: 10, y: 31, w: 38, h: 15 },
      { id: "immanuel-clubs-2", label: "2F 동아리실", kind: "office", x: 51, y: 31, w: 41, h: 15 },
      { id: "immanuel-clubs-3", label: "3F 동아리실\n학생자치공간", kind: "office", x: 10, y: 12, w: 82, h: 13 }
    ],
    rooms: [
      { name: "학생식당", use: "홀 면적이 가장 커 1층 중심 공간으로 배치" },
      { name: "편의점", use: "1층 소규모 상업 전면 공간" },
      { name: "동아리실 25개", use: "2~3층 반복 구획으로 표현" },
      { name: "HBS 오픈 스튜디오", use: "방송국 음향·조명 개선 자료 반영" },
      { name: "임상심리연구센터·취업지원센터", use: "B1F 기능 공간" }
    ]
  };

  data.gyeongsamInterior = {
    id: "gyeongsam-interior",
    title: "경삼관 내부",
    subtitle: "중앙도서관 1~4층 학습·지원 복합 공간",
    floor: "1F-4F",
    source: "캠퍼스 공개 조사 자료 6동 경삼관: 1~4층 시설 목록, 컬쳐라운지, 대학일자리센터, 박물관, 자료실, 메이커스페이스, 갤러리 확인",
    note: "층별 시설이 명확한 건물이라 공개 층별 기능을 그대로 세로 배치했습니다.",
    confirmed: [
      "1층 컬쳐라운지·대학일자리센터·현장실습지원센터 확인",
      "2층 자료실·스터디룸·박물관·상담/인권센터 확인",
      "3층 자료실·스터디룸·국제교류원·노트북전용 열람실 확인",
      "4층 소극장·메이커스페이스·한산갤러리·시설자산팀 확인",
      "경삼관 전면 버스정류장 존재 확인"
    ],
    zones: [
      { id: "gyeongsam-4f", label: "4F 소극장\n메이커스페이스·한산갤러리", kind: "gallery", x: 8, y: 10, w: 84, h: 14 },
      { id: "gyeongsam-3f", label: "3F 자료실·스터디룸\n국제교류원·노트북 열람실", kind: "library", x: 8, y: 29, w: 84, h: 14 },
      { id: "gyeongsam-2f", label: "2F 자료실·박물관\n상담센터·인권센터", kind: "library", x: 8, y: 48, w: 84, h: 14 },
      { id: "gyeongsam-1f", label: "1F 컬쳐라운지\n대학일자리센터·카페", kind: "lobby", x: 8, y: 67, w: 62, h: 16 },
      { id: "gyeongsam-bus", label: "버스정류장", kind: "outside", x: 73, y: 69, w: 19, h: 12 }
    ],
    rooms: [
      { name: "컬쳐라운지", use: "1층 학생 라운지" },
      { name: "대학일자리센터·현장실습지원센터", use: "1층 학생지원 기능" },
      { name: "자료실·스터디룸", use: "2~3층 도서관 핵심 공간" },
      { name: "박물관", use: "2층 전시·수장 기능" },
      { name: "메이커스페이스·한산갤러리", use: "4층 창작·전시 공간" }
    ]
  };

  data.songamInterior = {
    id: "songam-interior",
    title: "송암관 내부",
    subtitle: "1층 유사홀과 7108 실습실 중심",
    floor: "1F+",
    source: "캠퍼스 공개 조사 자료 7동 송암관: 1층 유사홀, 7108 실습실, 다목적 행사 사용, 송암관 앞 버스정류장 확인",
    note: "유사홀은 행사 중심의 큰 단일 공간으로, 7108 실습실은 별도 실습실 날개로 표현했습니다.",
    confirmed: [
      "1층 유사홀 강당 확인",
      "송암관 유사홀 다목적실 행사 사용 확인",
      "7108 실습실 확인",
      "송암관 앞 버스정류장 확인"
    ],
    zones: [
      { id: "songam-entry", label: "전면\n출입부", kind: "entry", x: 37, y: 78, w: 26, h: 10 },
      { id: "songam-yusa", label: "1F 유사홀\n다목적 강당", kind: "hall", x: 15, y: 28, w: 52, h: 42 },
      { id: "songam-stage", label: "무대", kind: "marker", x: 28, y: 17, w: 26, h: 8 },
      { id: "songam-lab", label: "7108\n실습실", kind: "lab", x: 70, y: 36, w: 18, h: 24 },
      { id: "songam-bus", label: "버스정류장", kind: "outside", x: 36, y: 90, w: 28, h: 6 }
    ],
    rooms: [
      { name: "유사홀", use: "특강·학위수여식·지역행사 등 다목적 강당" },
      { name: "7108 실습실", use: "생성형 AI 캠프 장소로 확인된 실습 공간" },
      { name: "전면 버스정류장", use: "송암관 앞 접근 동선 표현" }
    ]
  };

  data.sotongInterior = {
    id: "sotong-interior",
    title: "소통관 내부",
    subtitle: "1층 박물관 수장 기능과 상층 연구실",
    floor: "1F-4F+",
    source: "캠퍼스 공개 조사 자료 8동 소통관: 1층 수장고·유물정리실·기증도서 서고·연구실·행정실, 8101·8105·8110·8325·8431호 확인",
    note: "호수 체계상 상층 연구실 존재가 확인되지만 실제 층수는 미확정이라 연구실 밴드로 표현했습니다.",
    confirmed: [
      "소통관이 교수동/어학관으로 확인",
      "1층 수장고, 유물정리실, 기증도서 서고, 연구실, 행정실 확인",
      "8105 행정실 확인",
      "8101·8110 프로그램실 확인",
      "8325·8431 상층 연구실 주소 확인"
    ],
    zones: [
      { id: "sotong-upper", label: "상층 연구실\n8325·8431", kind: "office", x: 10, y: 12, w: 80, h: 20 },
      { id: "sotong-program", label: "8101·8110\n프로그램실", kind: "lecture", x: 12, y: 42, w: 26, h: 18 },
      { id: "sotong-admin", label: "8105\n행정실", kind: "office", x: 40, y: 42, w: 20, h: 18 },
      { id: "sotong-storage", label: "수장고\n유물정리실", kind: "support", x: 62, y: 42, w: 26, h: 18 },
      { id: "sotong-book", label: "기증도서 서고", kind: "library", x: 12, y: 68, w: 28, h: 14 },
      { id: "sotong-entry", label: "전면 도로\n관로 공사 흔적", kind: "outside", x: 45, y: 70, w: 43, h: 12 }
    ],
    rooms: [
      { name: "수장고·유물정리실", use: "박물관 관련 1층 보관/정리 기능" },
      { name: "8105 행정실", use: "미디어영상광고홍보학부 행정실" },
      { name: "8101·8110", use: "SW중심대학사업단 프로그램 장소" },
      { name: "8325·8431", use: "상층 연구실/기관 주소 단서" }
    ]
  };

  data.practiceInterior = {
    id: "practice-interior",
    title: "실습동 내부",
    subtitle: "송암관 연결통로와 2층 창업보육센터",
    floor: "2F 중심",
    source: "캠퍼스 공개 조사 자료 9동 실습동 + 한신대학교 창업보육센터 FAQ: 창업보육센터가 송암관 옆 실습동 2층에 위치",
    note: "공개 실별 목록은 부족하므로, 2층 창업보육센터와 송암관 연결부를 우선 구현했습니다.",
    confirmed: [
      "실습동은 송암관 좌측 건물로 확인",
      "송암관과 통로로 연결되어 있음",
      "창업보육센터가 실습동 2층에 위치함을 추가 확인",
      "과거 연결통로 지점 편의점이 다른 용도로 개조된 단서 확인"
    ],
    zones: [
      { id: "practice-bridge", label: "송암관\n연결통로", kind: "corridor", x: 8, y: 43, w: 20, h: 16 },
      { id: "practice-incubator", label: "2F\n창업보육센터", kind: "office", x: 33, y: 24, w: 45, h: 22 },
      { id: "practice-consult", label: "입주상담\n지원공간", kind: "support", x: 33, y: 52, w: 22, h: 18 },
      { id: "practice-companies", label: "입주기업실", kind: "lab", x: 57, y: 52, w: 21, h: 18 },
      { id: "practice-low", label: "저층 실습·작업\n공간 후보", kind: "lab", x: 33, y: 76, w: 45, h: 11 }
    ],
    rooms: [
      { name: "창업보육센터", use: "실습동 2층 공식 위치 확인" },
      { name: "입주기업실", use: "센터 기능에 맞춘 모델링용 세부 구획" },
      { name: "송암관 연결통로", use: "두 건물 사이 필수 동선" }
    ]
  };

  data.hanulInterior = {
    id: "hanul-interior",
    title: "한울관 내부",
    subtitle: "대운동장과 연결되는 실내체육관",
    floor: "1F",
    source: "캠퍼스 공개 조사 자료 10동 한울관: 체육관, 입학식 장소, 대운동장과 함께 사용되는 행사 축 확인",
    note: "세부 실 목록은 공개자료가 부족해, 체육관으로 자연스러운 주경기장·로비·부속실 중심으로 구성했습니다.",
    confirmed: [
      "한울관은 체육관으로 확인",
      "신입생 입학식 장소로 언급",
      "대운동장과 함께 위치",
      "샬롬채플관~한울관 앞 주차장 축 확인"
    ],
    zones: [
      { id: "hanul-entry", label: "로비\n입학식 동선", kind: "lobby", x: 36, y: 74, w: 28, h: 12 },
      { id: "hanul-court", label: "실내체육관\n주경기장", kind: "gym", x: 18, y: 21, w: 64, h: 46 },
      { id: "hanul-bleacher-l", label: "관람석", kind: "support", x: 8, y: 25, w: 8, h: 38 },
      { id: "hanul-bleacher-r", label: "관람석", kind: "support", x: 84, y: 25, w: 8, h: 38 },
      { id: "hanul-equipment", label: "운동기구\n보관", kind: "service", x: 70, y: 72, w: 18, h: 13 },
      { id: "hanul-stadium", label: "대운동장", kind: "outside", x: 20, y: 89, w: 60, h: 6 }
    ],
    rooms: [
      { name: "주경기장", use: "체육관의 가장 큰 단일 내부 공간" },
      { name: "로비", use: "입학식·행사 진입 동선" },
      { name: "관람석·보관실", use: "체육관 부속 기능" }
    ]
  };

  data.seongbinInterior = {
    id: "seongbin-interior",
    title: "성빈학사 내부",
    subtitle: "총 298실 기숙사와 복지시설",
    floor: "생활관",
    source: "캠퍼스 공개 조사 자료 11동 성빈학사 + 한신대학교 생활관 안내: 총 298실, 2인실 154실, 3인실 144실, 복지시설 확인",
    note: "신관·구관의 정확한 층별 배치는 미확인이라 2인실/3인실 군과 공용시설을 분리해 표현했습니다.",
    confirmed: [
      "총호실 298실 확인",
      "2인실 154실, 3인실 144실 확인",
      "1생활관·2생활관 수용인원 확인",
      "체력단련실, 전산실습실, 세탁실, 탁구장, 독서실, 매점, 기도실, 세미나실 확인",
      "각 방 LAN 설치 안내 확인"
    ],
    zones: [
      { id: "seongbin-new", label: "신관\n기숙사실", kind: "dorm", x: 8, y: 14, w: 24, h: 48 },
      { id: "seongbin-old-a", label: "구관\n2인실 154실", kind: "dorm", x: 38, y: 14, w: 24, h: 48 },
      { id: "seongbin-old-b", label: "구관\n3인실 144실", kind: "dorm", x: 68, y: 14, w: 24, h: 48 },
      { id: "seongbin-common", label: "복지시설\n체력·전산·세탁·독서", kind: "support", x: 14, y: 70, w: 52, h: 15 },
      { id: "seongbin-store", label: "매점·기도실\n세미나실", kind: "cafe", x: 68, y: 70, w: 24, h: 15 }
    ],
    rooms: [
      { name: "2인실 154실", use: "성빈학사 확정 호실 구성" },
      { name: "3인실 144실", use: "성빈학사 확정 호실 구성" },
      { name: "복지시설", use: "체력단련실, 전산실습실, 세탁실, 탁구장, 독서실 등" },
      { name: "공용 지원 공간", use: "매점, 기도실, 세미나실" }
    ]
  };

  data.saeromInterior = {
    id: "saerom-interior",
    title: "새롬터 내부",
    subtitle: "1층 영상문화관과 2층 카페",
    floor: "1F / 2F",
    source: "캠퍼스 공개 조사 자료 14동 새롬터: 1층 영상문화관, 2층 카페, 카페 159.27㎡ 확인",
    note: "2층 카페는 면적 확인값을 반영해 상층의 주 공간으로 크게 표현했습니다.",
    confirmed: [
      "새롬터는 2층 건물로 확인",
      "1층 영상문화관 확인",
      "2층 카페 확인",
      "2026 학생복지시설 임대 공고에서 2층 카페 159.27㎡ 확인"
    ],
    zones: [
      { id: "saerom-video", label: "1F\n영상문화관", kind: "studio", x: 18, y: 48, w: 64, h: 28 },
      { id: "saerom-cafe", label: "2F 카페\n159.27㎡", kind: "cafe", x: 18, y: 18, w: 46, h: 22 },
      { id: "saerom-terrace", label: "카페\n테라스", kind: "outside", x: 66, y: 18, w: 16, h: 22 },
      { id: "saerom-entry", label: "출입부", kind: "entry", x: 39, y: 80, w: 22, h: 8 }
    ],
    rooms: [
      { name: "영상문화관", use: "1층 문화·영상 기능" },
      { name: "카페", use: "2층 159.27㎡ 임대 공고 확인 공간" },
      { name: "테라스", use: "카페층 외부성을 살리는 모델링 요소" }
    ]
  };

  data.haeoreumInterior = {
    id: "haeoreum-interior",
    title: "해오름관 내부",
    subtitle: "1층 복지시설과 2층 심리·아동학부 실습실",
    floor: "1F / 2F",
    source: "캠퍼스 공개 조사 자료 17동 해오름관: 1층 여학생 휴게실·우체국·보건실, 2층 심리·아동학부 실습실·강의실 확인",
    note: baseNote,
    confirmed: [
      "1층 여학생 휴게실 확인",
      "1층 우체국과 보건실 확인",
      "과거 KB국민은행 한신대학교 지점 언급",
      "2층 심리·아동학부 실습실과 강의실 확인"
    ],
    zones: [
      { id: "haeoreum-2f-lab", label: "2F 심리·아동학부\n실습실", kind: "lab", x: 12, y: 14, w: 38, h: 24 },
      { id: "haeoreum-2f-class", label: "2F 강의실", kind: "lecture", x: 54, y: 14, w: 34, h: 24 },
      { id: "haeoreum-lounge", label: "1F 여학생\n휴게실", kind: "lounge", x: 12, y: 52, w: 24, h: 20 },
      { id: "haeoreum-post", label: "우체국", kind: "service", x: 40, y: 52, w: 18, h: 20 },
      { id: "haeoreum-health", label: "보건실", kind: "support", x: 62, y: 52, w: 26, h: 20 },
      { id: "haeoreum-bank", label: "구 은행\n흔적", kind: "marker", x: 40, y: 78, w: 20, h: 8 }
    ],
    rooms: [
      { name: "여학생 휴게실", use: "1층 복지 기능" },
      { name: "우체국·보건실", use: "1층 생활지원 기능" },
      { name: "심리·아동학부 실습실", use: "2층 전공 실습 기능" },
      { name: "강의실", use: "2층 교육 공간" }
    ]
  };

  data.joonhaInterior = {
    id: "joonha-interior",
    title: "장준하통일관 내부",
    subtitle: "1층 식당·편의시설과 컴퓨터 실습 공간",
    floor: "1F+",
    source: "캠퍼스 공개 조사 자료 18동 장준하통일관: 1층 CU·카페·학생식당, 식당 주방 128㎡·홀 366.80㎡, 컴퓨터 실습 공간 다수 확인",
    note: "컴퓨터 실습실의 정확한 수는 미확인이라 상층 반복 실습실 블록으로 표현했습니다.",
    confirmed: [
      "구 60주년기념관에서 장준하통일관으로 명칭 변경 확인",
      "1층 CU 편의점, 카페, 학생식당 확인",
      "학생식당 주방 128㎡, 홀 366.80㎡ 확인",
      "컴퓨터·공학계열 학생 이용과 컴퓨터 실습 공간 다수 언급"
    ],
    zones: [
      { id: "joonha-computer", label: "컴퓨터 실습실\n공학계열 공간", kind: "lab", x: 12, y: 14, w: 76, h: 25 },
      { id: "joonha-dining", label: "1F 학생식당\n홀 366.80㎡", kind: "dining", x: 12, y: 52, w: 44, h: 21 },
      { id: "joonha-kitchen", label: "주방\n128㎡", kind: "service", x: 58, y: 52, w: 16, h: 21 },
      { id: "joonha-cu", label: "CU", kind: "cafe", x: 76, y: 52, w: 12, h: 10 },
      { id: "joonha-cafe", label: "카페", kind: "cafe", x: 76, y: 64, w: 12, h: 9 },
      { id: "joonha-entry", label: "후방 끝\n진입부", kind: "entry", x: 38, y: 80, w: 24, h: 8 }
    ],
    rooms: [
      { name: "학생식당", use: "1층 홀·주방 면적 확인값 반영" },
      { name: "CU·카페", use: "1층 복지시설" },
      { name: "컴퓨터 실습실", use: "컴퓨터·공학계열 이용 특성 반영" }
    ]
  };

  data.neutbomInterior = {
    id: "neutbom-interior",
    title: "늦봄관 내부",
    subtitle: "B1~5F 최신 강의동과 만우관 구름다리",
    floor: "B1-5F",
    source: "캠퍼스 공개 조사 자료 20동 늦봄관: 지하 1층, 지상 5층, 최신 강의동, 만우관 구름다리 확인",
    note: "층수와 규모는 확인되어 층별 강의동 스택으로 표현하되, 실별 목록은 추정 구획으로 표시했습니다.",
    confirmed: [
      "지하 1층, 지상 5층 확인",
      "최신 건물이며 냉난방과 인테리어가 좋다는 설명 확인",
      "만우관과 구름다리로 연결됨",
      "최고높이 24m, 연면적 2,979.36㎡ 확인"
    ],
    zones: [
      { id: "neutbom-5f", label: "5F 강의·세미나", kind: "lecture", x: 12, y: 10, w: 60, h: 10 },
      { id: "neutbom-4f", label: "4F 강의실", kind: "lecture", x: 12, y: 24, w: 60, h: 10 },
      { id: "neutbom-3f", label: "3F 강의실", kind: "lecture", x: 12, y: 38, w: 60, h: 10 },
      { id: "neutbom-2f", label: "2F 강의실", kind: "lecture", x: 12, y: 52, w: 60, h: 10 },
      { id: "neutbom-1f", label: "1F 로비·강의실", kind: "lobby", x: 12, y: 66, w: 60, h: 10 },
      { id: "neutbom-b1", label: "B1", kind: "support", x: 12, y: 80, w: 60, h: 8 },
      { id: "neutbom-bridge", label: "만우관\n구름다리", kind: "corridor", x: 76, y: 36, w: 14, h: 28 }
    ],
    rooms: [
      { name: "강의실 스택", use: "지상 5층 최신 강의동 성격 표현" },
      { name: "B1", use: "확인된 지하층 표현" },
      { name: "만우관 구름다리", use: "만우관과 연결되는 필수 내부/외부 동선" }
    ]
  };

  data.childcareInterior = {
    id: "childcare-interior",
    title: "한신어린이집 내부",
    subtitle: "1층 보육실 5개와 인근 놀이터",
    floor: "1F",
    source: "캠퍼스 공개 조사 자료 21동 한신어린이집 + 어린이집정보공개포털: 보육실 5개 159㎡, 총 1층, 전용면적 215㎡, 인근 놀이터 132㎡ 확인",
    note: "동명 어린이집이 여럿 있어 정보공개포털의 오산시 한신어린이집 항목을 기준으로 반영했습니다.",
    confirmed: [
      "건물층수 총 1층 확인",
      "건물 전용면적 215㎡ 확인",
      "보육실 5개, 보육실 면적 159㎡ 확인",
      "인근 놀이터 132㎡ 확인",
      "보건/위생공간 19㎡, 조리/급식공간 12㎡, 교사실 13㎡, 사무실/기타 12㎡ 확인"
    ],
    zones: [
      { id: "childcare-rooms", label: "보육실 5개\n159㎡", kind: "childcare", x: 12, y: 18, w: 50, h: 36 },
      { id: "childcare-office", label: "교사실\n13㎡", kind: "office", x: 66, y: 18, w: 18, h: 14 },
      { id: "childcare-health", label: "보건·위생\n19㎡", kind: "support", x: 66, y: 36, w: 18, h: 14 },
      { id: "childcare-kitchen", label: "조리·급식\n12㎡", kind: "service", x: 66, y: 54, w: 18, h: 14 },
      { id: "childcare-entry", label: "안전 현관", kind: "entry", x: 38, y: 65, w: 20, h: 10 },
      { id: "childcare-playground", label: "인근 놀이터\n132㎡", kind: "outside", x: 18, y: 80, w: 64, h: 10 }
    ],
    rooms: [
      { name: "보육실 5개", use: "보육실 수와 면적 확인값 반영" },
      { name: "보건/위생공간", use: "영유아 시설 필수 지원 공간" },
      { name: "조리/급식공간", use: "12㎡ 확인값 반영" },
      { name: "인근 놀이터", use: "132㎡ 놀이공간을 외부 영역으로 표현" }
    ]
  };

  function enrichInterior(key, patch) {
    const target = data[key];
    if (!target) return;
    if (patch.title) target.title = patch.title;
    if (patch.subtitle) target.subtitle = patch.subtitle;
    if (patch.floor) target.floor = patch.floor;
    if (patch.source) target.source = patch.source;
    if (patch.note) target.note = patch.note;
    target.confirmed = [...(target.confirmed || []), ...(patch.confirmed || [])];
    target.zones = [...(target.zones || []), ...(patch.zones || [])];
    target.rooms = [...(target.rooms || []), ...(patch.rooms || [])];
  }

  enrichInterior("janggongInterior", {
    title: "장공관 내부",
    subtitle: "본관 로비, 행정실, 총장실, 비전룸, 대회의실",
    floor: "1F-3F",
    source: "캠퍼스 공개 조사 자료와 공식 공지·보도 기반: 1층 로비/AED/총무팀, 2층 총장실, 3층 1308 비전룸·1318 대회의실 확인",
    note: "1층 상세 배치를 유지하되, 2~3층의 확인된 회의·보직자 공간을 상단 별도 구역으로 덧붙인 축소 평면입니다.",
    confirmed: [
      "2층 총장실 보도 확인",
      "3층 1308 비전룸 회의 장소 확인",
      "3층 1318 회의실·대회의실이 제안평가회와 행사 장소로 반복 확인"
    ],
    zones: [
      { id: "president-office", label: "2F\n총장실", kind: "office", x: 10, y: 3, w: 20, h: 8 },
      { id: "vision-room-1308", label: "3F 1308\n비전룸", kind: "hall", x: 34, y: 3, w: 20, h: 8 },
      { id: "meeting-1318", label: "3F 1318\n대회의실", kind: "hall", x: 58, y: 3, w: 29, h: 8 }
    ],
    rooms: [
      { name: "총장실", use: "2층 보직자·공식 접견 공간" },
      { name: "1308 비전룸", use: "대학평의원회와 협약 등 회의 장소" },
      { name: "1318 대회의실", use: "제안평가회·시상식·교육·장학금 전달식 장소" }
    ]
  });

  enrichInterior("shalomInterior", {
    source: "캠퍼스 공개 조사 자료와 교목실 공식 안내 기반: 대예배실, 1층 4106 교목실, 채플·문화채플·특강·상담 프로그램, 티움 청소년캠프 장소 확인",
    confirmed: [
      "교목실 공식 안내에서 정기 채플, 문화채플, 특강 운영 확인",
      "교목실이 신앙 상담, 학교 적응, 대인관계, 진로코칭 프로그램을 운영함",
      "2026 티움 청소년캠프 장소가 경기캠퍼스 샬롬채플로 확인"
    ],
    zones: [
      { id: "shalom-seating", label: "채플 좌석\n집회 구역", kind: "hall", x: 27, y: 31, w: 46, h: 23 },
      { id: "shalom-culture", label: "문화채플\n영상·음악·연극", kind: "studio", x: 13, y: 27, w: 12, h: 26 },
      { id: "shalom-counsel", label: "상담·비교과\n프로그램", kind: "support", x: 72, y: 25, w: 16, h: 18 },
      { id: "shalom-camp", label: "티움 캠프\n운영 지원", kind: "support", x: 72, y: 47, w: 16, h: 15 }
    ],
    rooms: [
      { name: "문화채플 운영 구역", use: "영상, 음악, 연극 등 문화채플 성격을 반영한 대예배실 내부 연출 공간" },
      { name: "상담·비교과 프로그램실", use: "교목실의 신앙 상담, 학교 적응, 대인관계, 진로코칭 프로그램 단서 반영" },
      { name: "캠프 운영 지원 구역", use: "티움 청소년캠프 등 대형 프로그램 운영을 위한 지원 공간" }
    ]
  });

  enrichInterior("immanuelInterior", {
    source: "캠퍼스 공개 조사 자료, 학생복지시설 임대 공고, 학교 시설개선 보도, 교내 식단 공지 기반: 학생식당·편의점·동아리실·학보사·방송국·사회봉사단 확인",
    confirmed: [
      "교내 식단 공지에서 임마누엘관 학생식당 중식 운영 확인",
      "학생복지시설 임대 공고에서 임마누엘관 식당이 한식·간편식 등으로 제시됨",
      "시설개선 보도에서 방송국 오픈 스튜디오와 사회봉사단실 리모델링 확인"
    ],
    zones: [
      { id: "immanuel-menu", label: "한식·간편식\n배식 라인", kind: "service", x: 18, y: 51, w: 24, h: 7 },
      { id: "immanuel-seating", label: "식당 좌석\n대형 홀", kind: "dining", x: 12, y: 61, w: 45, h: 10 },
      { id: "immanuel-newsroom", label: "학보사", kind: "office", x: 12, y: 27, w: 16, h: 8 },
      { id: "immanuel-hbs-control", label: "HBS\n조정·촬영", kind: "studio", x: 30, y: 27, w: 17, h: 8 },
      { id: "immanuel-volunteer", label: "사회봉사단실", kind: "office", x: 50, y: 48, w: 18, h: 8 },
      { id: "immanuel-restroom", label: "2·3F\n리모델링 화장실", kind: "restroom", x: 72, y: 29, w: 14, h: 13 }
    ],
    rooms: [
      { name: "배식 라인", use: "학생식당 중식 운영과 한식·간편식 입찰 단서 반영" },
      { name: "학보사", use: "학생자치 언론 공간" },
      { name: "HBS 조정·촬영 구역", use: "오픈 스튜디오 장비·음향·조명 개선 단서 반영" },
      { name: "사회봉사단실", use: "시설개선 보도에서 확인된 학생자치 공간" },
      { name: "2·3층 화장실 코어", use: "리모델링 공지 단서를 실제 층별 코어로 반영" }
    ]
  });

  enrichInterior("gyeongsamInterior", {
    floor: "B1-4F",
    source: "캠퍼스 공개 조사 자료, 한신대학교 도서관 안내, 중앙도서관 사이트, 장애학생지원센터·국제학생증 공식 안내 기반",
    confirmed: [
      "오산 중앙도서관은 서관 1991년, 동관 1997년 완공으로 확인",
      "도서관은 지상 3층·지하 1층, 연건평 2,000여 평, 장서 30만 권 수용 가능으로 안내됨",
      "중앙도서관 자료실 운영시간이 공식 도서관 사이트에서 확인됨",
      "장애학생지원센터가 경삼관 4층 학생복지팀 내에 위치함",
      "국제학생증 발급부서가 경삼관 4층 학생복지팀으로 확인됨"
    ],
    zones: [
      { id: "gyeongsam-b1-stack", label: "B1\n서고·설비 후보", kind: "library", x: 8, y: 87, w: 84, h: 8 },
      { id: "gyeongsam-west-east", label: "서관 1991\n동관 1997", kind: "marker", x: 72, y: 10, w: 20, h: 10 },
      { id: "gyeongsam-300k", label: "장서\n30만권", kind: "library", x: 58, y: 31, w: 15, h: 10 },
      { id: "gyeongsam-reading-hours", label: "자료실\n운영시간", kind: "support", x: 75, y: 31, w: 17, h: 10 },
      { id: "gyeongsam-student-welfare", label: "4F 학생복지팀\n국제학생증", kind: "office", x: 10, y: 12, w: 24, h: 9 },
      { id: "gyeongsam-able", label: "4F 장애학생\n지원센터", kind: "support", x: 36, y: 12, w: 20, h: 9 }
    ],
    rooms: [
      { name: "서관·동관 구분", use: "1991년 서관, 1997년 동관 완공 단서를 내부도 구조에 반영" },
      { name: "지하 1층", use: "도서관 안내의 지하층 정보를 하단 서고·설비 후보 구역으로 표현" },
      { name: "장서 30만 권 자료구역", use: "자료실·서가 밀도를 시각적으로 강화" },
      { name: "학생복지팀", use: "경삼관 4층 국제학생증 발급부서" },
      { name: "장애학생지원센터", use: "경삼관 4층 학생복지팀 내 위치와 기자재 대여 업무 반영" }
    ]
  });

  enrichInterior("practiceInterior", {
    source: "캠퍼스 공개 조사 자료, 창업보육센터 FAQ·신규 입주기업 모집 공고·현장실습센터 안내 기반",
    confirmed: [
      "창업보육센터는 예비창업자와 창업 3년 미만 초기기업을 모집함",
      "입주기업에 사업화 지원금 및 프로그램 지원이 제공됨",
      "모집분야로 전기/전자, 정보통신, 반도체, 정밀기계, S/W 등 기술기반 업종이 제시됨",
      "현장실습은 산업체 현장에서 실무교육과 실습을 실시하는 산학협력 교육 과정으로 설명됨"
    ],
    zones: [
      { id: "practice-screening", label: "입주심사\n상담", kind: "office", x: 31, y: 16, w: 20, h: 9 },
      { id: "practice-program", label: "사업화 지원\n프로그램", kind: "support", x: 53, y: 16, w: 24, h: 9 },
      { id: "practice-it-lab", label: "정보통신·S/W\n입주기업", kind: "lab", x: 34, y: 49, w: 20, h: 15 },
      { id: "practice-hardware-lab", label: "전기·전자\n반도체", kind: "lab", x: 56, y: 49, w: 22, h: 15 },
      { id: "practice-field-training", label: "현장실습\n산학연계", kind: "lecture", x: 35, y: 69, w: 28, h: 9 }
    ],
    rooms: [
      { name: "입주심사·상담실", use: "입주상담예약과 신규 입주기업 모집 절차 반영" },
      { name: "사업화 지원 프로그램실", use: "사업화 지원금 및 프로그램 지원 단서 반영" },
      { name: "정보통신·S/W 입주기업실", use: "모집분야 중 소프트웨어·정보통신 업종 반영" },
      { name: "전기·전자·반도체 실험형 입주실", use: "기술기반 제조·반도체 우대 분야 반영" },
      { name: "현장실습 산학연계 구역", use: "현장실습센터의 산학협력 실무교육 성격을 실습동에 보조 반영" }
    ]
  });

  enrichInterior("hanulInterior", {
    source: "캠퍼스 공개 조사 자료와 학교 행사 공지 기반: 체육관, 입학식, 대운동장 행사, 샬롬채플관~한울관 앞 주차장 축 확인",
    confirmed: [
      "한울관 앞 대운동장이 대동제 장소로 활용됨",
      "샬롬채플관~한울관 실내체육관 앞 주차장 축이 학위수여식 주차 통제 안내에서 함께 언급됨"
    ],
    zones: [
      { id: "hanul-event-stage", label: "입학식\n행사 단상", kind: "hall", x: 36, y: 15, w: 28, h: 8 },
      { id: "hanul-athlete", label: "선수·행사\n대기", kind: "support", x: 70, y: 22, w: 14, h: 13 },
      { id: "hanul-control", label: "음향·진행\n운영", kind: "studio", x: 70, y: 38, w: 14, h: 12 },
      { id: "hanul-parking-axis", label: "채플~한울관\n주차장 축", kind: "outside", x: 12, y: 82, w: 22, h: 7 }
    ],
    rooms: [
      { name: "행사 단상", use: "입학식 등 대형 행사를 위한 체육관 전면 구역" },
      { name: "대기실", use: "행사·체육 활동을 위한 부속 지원 공간" },
      { name: "음향·진행 운영석", use: "입학식·대동제 등 행사 운영 성격 반영" },
      { name: "채플~한울관 주차장 축", use: "대형 행사 접근·통제 동선을 외부 구역으로 표시" }
    ]
  });

  enrichInterior("seongbinInterior", {
    source: "캠퍼스 공개 조사 자료와 한신대학교 생활관 안내 기반: 성빈학사 298실, 생활관 식당, 사생회, LAN, 복지시설 확인",
    confirmed: [
      "생활관은 사생회에서 운영하는 식당을 통해 숙식과 편의를 제공한다고 안내됨",
      "각 방에는 LAN이 설치되어 자료 검색이 가능하다고 안내됨",
      "입사 대상은 신입생, 재학생, 복학생, 편입생, 대학원생으로 확인"
    ],
    zones: [
      { id: "seongbin-dining", label: "생활관 식당\n사생회 운영", kind: "dining", x: 18, y: 86, w: 34, h: 8 },
      { id: "seongbin-lan", label: "각 방 LAN\n학습 네트워크", kind: "support", x: 54, y: 86, w: 28, h: 8 },
      { id: "seongbin-laundry", label: "세탁실", kind: "service", x: 16, y: 63, w: 13, h: 7 },
      { id: "seongbin-study", label: "독서실\n전산실습실", kind: "library", x: 31, y: 63, w: 22, h: 7 },
      { id: "seongbin-fitness", label: "체력단련\n탁구장", kind: "gym", x: 55, y: 63, w: 19, h: 7 },
      { id: "seongbin-seminar", label: "기도실\n세미나실", kind: "hall", x: 76, y: 63, w: 15, h: 7 }
    ],
    rooms: [
      { name: "생활관 식당", use: "사생회 운영 식당 단서를 기숙사 내부 핵심 편의시설로 반영" },
      { name: "LAN 학습 네트워크", use: "각 방 LAN 설치 안내를 기숙사실 기능으로 표시" },
      { name: "세탁실", use: "생활관 복지시설 목록의 생활 지원 공간" },
      { name: "독서실·전산실습실", use: "기숙사 내 학습 지원 공간" },
      { name: "체력단련실·탁구장", use: "기숙사 내 여가·운동 공간" }
    ]
  });

  enrichInterior("saeromInterior", {
    source: "캠퍼스 공개 조사 자료와 학생복지시설 임대 공고 기반: 1층 영상문화관, 2층 카페 159.27㎡, 업체 선택제안 가능 공간 확인",
    confirmed: [
      "학생복지시설 임대 공고에서 새롬터 2층 카페는 업체측 선택제안 가능 공간으로 제시됨"
    ],
    zones: [
      { id: "saerom-screening", label: "영상 상영\n소규모 홀", kind: "hall", x: 25, y: 56, w: 31, h: 12 },
      { id: "saerom-media-support", label: "장비·편집\n지원", kind: "studio", x: 58, y: 56, w: 16, h: 12 },
      { id: "saerom-counter", label: "카페\n카운터", kind: "service", x: 20, y: 16, w: 18, h: 8 },
      { id: "saerom-seating", label: "카페 좌석", kind: "cafe", x: 40, y: 16, w: 22, h: 15 }
    ],
    rooms: [
      { name: "영상 상영 홀", use: "영상문화관 성격을 구체화한 내부 주요 공간" },
      { name: "장비·편집 지원실", use: "영상문화관의 운영 지원 기능으로 반영" },
      { name: "카페 카운터·좌석", use: "2층 카페를 상업공간 내부 구획으로 분리" }
    ]
  });

  enrichInterior("joonhaInterior", {
    source: "캠퍼스 공개 조사 자료, 학생복지시설 임대 공고, 교내 식단 공지 기반: 장준하통일관 1층 학생식당·CU·카페·컴퓨터 실습공간 확인",
    confirmed: [
      "학생복지시설 임대 공고에서 장준하통일관 학생식당은 푸드코트 제안 가능으로 제시됨",
      "교내 식단 공지에서 장준하통일관 학생식당 중식 운영 확인",
      "천원의 아침밥 간편식 제공 장소로 장준하통일관 CU편의점이 확인됨"
    ],
    zones: [
      { id: "joonha-foodcourt", label: "푸드코트\n제안 가능", kind: "dining", x: 14, y: 47, w: 28, h: 8 },
      { id: "joonha-breakfast", label: "천원의 아침밥\n간편식", kind: "cafe", x: 76, y: 44, w: 12, h: 8 },
      { id: "joonha-computer-a", label: "PC 실습실 A", kind: "lab", x: 15, y: 18, w: 20, h: 10 },
      { id: "joonha-computer-b", label: "PC 실습실 B", kind: "lab", x: 37, y: 18, w: 20, h: 10 },
      { id: "joonha-computer-c", label: "프로젝트\n실습실", kind: "lab", x: 59, y: 18, w: 26, h: 10 }
    ],
    rooms: [
      { name: "푸드코트형 학생식당", use: "입찰 공고의 푸드코트 제안 가능 조건 반영" },
      { name: "천원의 아침밥 간편식 동선", use: "장준하통일관 CU편의점의 아침 간편식 운영 단서 반영" },
      { name: "PC 실습실 A/B", use: "컴퓨터 실습 공간 다수 언급을 복수 실습실로 세분화" },
      { name: "프로젝트 실습실", use: "컴퓨터·공학계열 학생 이용 특성을 반영한 팀 실습 구역" }
    ]
  });

  enrichInterior("neutbomInterior", {
    source: "캠퍼스 공개 조사 자료와 건축문화 늦봄관 공개 정보 기반: B1~5F, 최고높이 24m, 철근콘크리트조, 투명복층유리, 만우관 연결 구름다리 확인",
    confirmed: [
      "늦봄관은 철근콘크리트조와 투명복층유리 마감이 확인됨",
      "최고높이 24m, 연면적 2,979.36㎡ 규모가 확인됨"
    ],
    zones: [
      { id: "neutbom-glass-lounge", label: "투명복층유리\n채광 라운지", kind: "lounge", x: 45, y: 10, w: 26, h: 10 },
      { id: "neutbom-core", label: "계단·승강\n코어", kind: "corridor", x: 74, y: 10, w: 12, h: 70 },
      { id: "neutbom-b1-support", label: "B1 설비·지원", kind: "service", x: 14, y: 86, w: 28, h: 7 },
      { id: "neutbom-modern-class", label: "최신 냉난방\n강의실", kind: "lecture", x: 44, y: 86, w: 28, h: 7 }
    ],
    rooms: [
      { name: "채광 라운지", use: "투명복층유리 마감과 최신 건물 성격을 내부 휴게 공간으로 표현" },
      { name: "수직 코어", use: "B1~5F 층간 이동을 실제 강의동처럼 읽히게 하는 계단·승강 구역" },
      { name: "B1 설비·지원실", use: "지하층을 단순 표시가 아닌 지원 기능으로 세분화" },
      { name: "최신 냉난방 강의실", use: "최신 건물·인테리어 개선 설명 반영" }
    ]
  });

  enrichInterior("songamInterior", {
    source: "캠퍼스 공개 조사 자료, SW중심대학사업단 캠프 공지, 학위수여식·취업특강·지역행사 보도 기반: 유사홀, 다목적실, 7108 실습실, 전면 버스정류장 확인",
    confirmed: [
      "유사홀은 외국인 유학생 학위수여식, 취업 특강, 지역 토크콘서트 등 다목적 행사 장소로 반복 확인",
      "생성형AI맛보기 캠프 장소로 유사홀과 7108 실습실이 함께 확인됨"
    ],
    zones: [
      { id: "songam-audience", label: "행사 객석\n다목적실", kind: "hall", x: 21, y: 38, w: 40, h: 22 },
      { id: "songam-backstage", label: "무대 후면\n준비", kind: "support", x: 29, y: 11, w: 24, h: 6 },
      { id: "songam-lobby", label: "행사 대기\n로비", kind: "lobby", x: 31, y: 69, w: 32, h: 8 },
      { id: "songam-ai-practice", label: "AI 캠프\n실습 준비", kind: "lab", x: 70, y: 62, w: 18, h: 10 },
      { id: "songam-bus-wait", label: "버스 승차\n대기", kind: "outside", x: 64, y: 88, w: 25, h: 6 }
    ],
    rooms: [
      { name: "행사 객석", use: "학위수여식·특강·토크콘서트 등 반복 행사 사용을 반영" },
      { name: "무대 후면 준비 구역", use: "유사홀 강당 운영에 필요한 행사 지원 공간" },
      { name: "행사 대기 로비", use: "다목적실 이용 전후 집결 동선" },
      { name: "AI 캠프 실습 준비 구역", use: "유사홀과 7108 실습실이 함께 쓰인 프로그램 단서 반영" },
      { name: "버스 승차 대기 구역", use: "송암관 앞 버스정류장 단서를 외부 동선으로 구체화" }
    ]
  });

  function setFloors(key, floors, label) {
    const target = data[key];
    if (!target) return;
    target.floors = floors;
    target.floor = label || floors.join(" / ");
  }

  function setZoneFloor(key, ids, floor) {
    const target = data[key];
    if (!target) return;
    target.zones.forEach((zone) => {
      if (ids.includes(zone.id)) zone.floor = floor;
    });
  }

  function setFootprints(key, footprints) {
    const target = data[key];
    if (!target) return;
    target.footprints = footprints;
  }

  setFloors("janggongInterior", ["1F", "2F", "3F", "외부"], "확인층 1F-3F");
  setZoneFloor("janggongInterior", ["president-office"], "2F");
  setZoneFloor("janggongInterior", ["vision-room-1308", "meeting-1318"], "3F");
  setZoneFloor("janggongInterior", ["front-parking"], "외부");

  setFloors("pilheonInterior", ["1F", "2F"], "확인층 1F-2F");
  setZoneFloor("pilheonInterior", ["pilheon-1f-label", "pilheon-entry", "pilheon-office", "pilheon-1f-corridor"], "1F");
  setZoneFloor("pilheonInterior", ["pilheon-2f-label", "pilheon-203", "pilheon-204", "pilheon-exam", "pilheon-wait"], "2F");

  setFloors("manwooInterior", ["B1", "1F", "2F", "3F", "4F", "5F", "외부"], "확인층 B1-5F");
  setZoneFloor("manwooInterior", ["manwoo-b1"], "B1");
  setZoneFloor("manwooInterior", ["manwoo-2f-cafe"], "2F");
  setZoneFloor("manwooInterior", ["manwoo-3f-lounge", "manwoo-3f-class"], "3F");
  setZoneFloor("manwooInterior", ["manwoo-4f"], "4F");
  setZoneFloor("manwooInterior", ["manwoo-5f"], "5F");
  setZoneFloor("manwooInterior", ["manwoo-exit"], "외부");

  setFloors("shalomInterior", ["B1", "1F", "외부"], "확인층 B1 / 1F");
  setZoneFloor("shalomInterior", ["shalom-b1"], "B1");
  setZoneFloor("shalomInterior", ["shalom-porch"], "외부");

  setFloors("immanuelInterior", ["B1", "1F", "2F", "3F"], "확인층 B1-3F");
  setZoneFloor("immanuelInterior", ["immanuel-b1"], "B1");
  setZoneFloor("immanuelInterior", ["immanuel-dining", "immanuel-kitchen", "immanuel-store", "immanuel-menu", "immanuel-seating"], "1F");
  setZoneFloor("immanuelInterior", ["immanuel-2f", "immanuel-clubs-2", "immanuel-newsroom", "immanuel-hbs-control"], "2F");
  setZoneFloor("immanuelInterior", ["immanuel-clubs-3", "immanuel-volunteer", "immanuel-restroom"], "3F");

  setFloors("gyeongsamInterior", ["B1", "1F", "2F", "3F", "4F", "외부"], "확인층 B1-4F");
  setZoneFloor("gyeongsamInterior", ["gyeongsam-b1-stack"], "B1");
  setZoneFloor("gyeongsamInterior", ["gyeongsam-1f", "gyeongsam-bus"], "1F");
  setZoneFloor("gyeongsamInterior", ["gyeongsam-2f"], "2F");
  setZoneFloor("gyeongsamInterior", ["gyeongsam-3f", "gyeongsam-300k", "gyeongsam-reading-hours"], "3F");
  setZoneFloor("gyeongsamInterior", ["gyeongsam-4f", "gyeongsam-student-welfare", "gyeongsam-able"], "4F");
  setZoneFloor("gyeongsamInterior", ["gyeongsam-bus"], "외부");

  setFloors("songamInterior", ["1F", "외부"], "확인층 1F");
  setZoneFloor("songamInterior", ["songam-bus", "songam-bus-wait"], "외부");

  setFloors("sotongInterior", ["1F", "2F", "3F", "4F", "외부"], "확인층 1F-4F");
  setZoneFloor("sotongInterior", ["sotong-program", "sotong-admin", "sotong-storage", "sotong-book"], "1F");
  setZoneFloor("sotongInterior", ["sotong-upper"], "4F");
  setZoneFloor("sotongInterior", ["sotong-entry"], "외부");

  setFloors("practiceInterior", ["1F", "2F", "외부"], "확인층 1F-2F");
  setZoneFloor("practiceInterior", ["practice-low", "practice-field-training"], "1F");
  setZoneFloor("practiceInterior", ["practice-incubator", "practice-consult", "practice-companies", "practice-screening", "practice-program", "practice-it-lab", "practice-hardware-lab"], "2F");
  setZoneFloor("practiceInterior", ["practice-bridge"], "외부");

  setFloors("hanulInterior", ["1F", "외부"], "확인층 1F");
  setZoneFloor("hanulInterior", ["hanul-stadium", "hanul-parking-axis"], "외부");

  setFloors("seongbinInterior", ["제1생활관", "제2생활관", "공용"], "생활관 동별 구분");
  setZoneFloor("seongbinInterior", ["seongbin-old-a"], "제1생활관");
  setZoneFloor("seongbinInterior", ["seongbin-new", "seongbin-old-b"], "제2생활관");
  setZoneFloor("seongbinInterior", ["seongbin-common", "seongbin-store", "seongbin-dining", "seongbin-lan", "seongbin-laundry", "seongbin-study", "seongbin-fitness", "seongbin-seminar"], "공용");

  setFloors("saeromInterior", ["1F", "2F", "외부"], "확인층 1F-2F");
  setZoneFloor("saeromInterior", ["saerom-video", "saerom-screening", "saerom-media-support", "saerom-entry"], "1F");
  setZoneFloor("saeromInterior", ["saerom-cafe", "saerom-counter", "saerom-seating"], "2F");
  setZoneFloor("saeromInterior", ["saerom-terrace"], "외부");

  setFloors("haeoreumInterior", ["1F", "2F"], "확인층 1F-2F");
  setZoneFloor("haeoreumInterior", ["haeoreum-lounge", "haeoreum-post", "haeoreum-health", "haeoreum-bank"], "1F");
  setZoneFloor("haeoreumInterior", ["haeoreum-2f-lab", "haeoreum-2f-class"], "2F");

  enrichInterior("joonhaInterior", {
    title: "장준하통일관 내부",
    subtitle: "1층 기념·복지시설, 4층 AI·SW 행정, 5층 국제회의실",
    floor: "확인층 1F-5F",
    source: "공개 조사 자료, 장준하통일관 개관 보도, SW중심대학사업단 오시는 길, AI빅데이터센터 보도 기반: 1층 장준하 기념홀·기억의 방, 4층 18423호, 5층 국제회의실 18517호 확인",
    confirmed: [
      "장준하통일관 1층 로비에 장준하 기념홀과 장준하 기억의 방이 조성됨",
      "장준하통일관 1층 중앙정원에 돌베개 공원이 조성됨",
      "SW중심대학사업단 주소가 장준하통일관 4층 18423호로 확인됨",
      "AI 시스템반도체전공 사무실과 대학행정팀 위치가 장준하통일관 18421-1호로 확인됨",
      "AI빅데이터센터 설립 기념식과 SW교육 캠프 장소가 장준하통일관 5층 국제회의실 18517호로 확인됨"
    ],
    zones: [
      { id: "joonha-memorial-hall", label: "장준하\n기념홀", kind: "gallery", floor: "1F", x: 12, y: 16, w: 28, h: 16 },
      { id: "joonha-memory-room", label: "장준하\n기억의 방", kind: "gallery", floor: "1F", x: 42, y: 16, w: 22, h: 16 },
      { id: "joonha-garden-1f", label: "중앙정원\n돌베개 공원", kind: "outside", floor: "1F", x: 66, y: 16, w: 20, h: 16 },
      { id: "joonha-sw-office-18423", label: "4F 18423\nSW중심대학사업단", kind: "office", floor: "4F", x: 12, y: 18, w: 35, h: 18 },
      { id: "joonha-ai-office-18421", label: "4F 18421-1\nAI·SW 행정", kind: "office", floor: "4F", x: 50, y: 18, w: 35, h: 18 },
      { id: "joonha-conference-18517", label: "5F 18517\n국제회의실", kind: "hall", floor: "5F", x: 16, y: 20, w: 48, h: 24 },
      { id: "joonha-large-lecture-5f", label: "5F 대강의실\nSW교육 캠프", kind: "lecture", floor: "5F", x: 66, y: 20, w: 22, h: 24 }
    ],
    rooms: [
      { name: "장준하 기념홀", use: "1층 로비의 상설 전시 공간" },
      { name: "장준하 기억의 방", use: "1층 기념 전시실" },
      { name: "돌베개 공원", use: "1층 중앙정원 기념 공간" },
      { name: "SW중심대학사업단 18423호", use: "4층 사업단 위치 확인" },
      { name: "AI·SW 행정 18421-1호", use: "4층 AI 시스템반도체전공/대학행정팀 주소 단서" },
      { name: "국제회의실 18517호", use: "5층 공식 행사 장소" },
      { name: "5층 대강의실", use: "AI·SW 오리엔테이션 및 SW교육 캠프 장소 단서" }
    ]
  });
  setFloors("joonhaInterior", ["1F", "2F", "3F", "4F", "5F", "외부"], "확인층 1F-5F");
  setZoneFloor("joonhaInterior", [
    "joonha-dining", "joonha-kitchen", "joonha-cu", "joonha-cafe", "joonha-entry", "joonha-foodcourt", "joonha-breakfast",
    "joonha-memorial-hall", "joonha-memory-room", "joonha-garden-1f"
  ], "1F");
  setZoneFloor("joonhaInterior", ["joonha-computer", "joonha-computer-a", "joonha-computer-b", "joonha-computer-c", "joonha-sw-office-18423", "joonha-ai-office-18421"], "4F");
  setZoneFloor("joonhaInterior", ["joonha-conference-18517", "joonha-large-lecture-5f"], "5F");

  setFloors("neutbomInterior", ["B1", "1F", "2F", "3F", "4F", "5F"], "확인층 B1-5F");
  setZoneFloor("neutbomInterior", ["neutbom-b1", "neutbom-b1-support"], "B1");
  setZoneFloor("neutbomInterior", ["neutbom-1f"], "1F");
  setZoneFloor("neutbomInterior", ["neutbom-2f"], "2F");
  setZoneFloor("neutbomInterior", ["neutbom-3f"], "3F");
  setZoneFloor("neutbomInterior", ["neutbom-4f"], "4F");
  setZoneFloor("neutbomInterior", ["neutbom-5f", "neutbom-glass-lounge"], "5F");
  setZoneFloor("neutbomInterior", ["neutbom-core"], "1F");
  setZoneFloor("neutbomInterior", ["neutbom-bridge", "neutbom-modern-class"], "2F");

  setFloors("childcareInterior", ["1F", "2F", "3F", "외부"], "확인층 1F-3F");
  setZoneFloor("childcareInterior", ["childcare-rooms", "childcare-office", "childcare-health", "childcare-kitchen", "childcare-entry"], "3F");
  setZoneFloor("childcareInterior", ["childcare-playground"], "외부");

  enrichInterior("janggongInterior", {
    source: "추가 공개 조사: 교내 입찰·협정·검진기관 선정 공지에서 장공관 1층 총무팀, 3층 1318 회의실 반복 사용 확인",
    confirmed: [
      "교직원 건강검진기관 선정 입찰에서 입찰참가서류 제출처가 장공관 1층 총무팀으로 확인",
      "학생복지시설 임대업체 선정, 생활관 편의점 임대업체 선정, 협정식 기사에서 장공관 3층 1318 회의실 반복 확인"
    ],
    zones: [
      { id: "janggong-general-affairs", label: "1F 총무팀\n입찰 서류 접수", kind: "office", floor: "1F", x: 12, y: 23, w: 24, h: 11 },
      { id: "janggong-1318-eval", label: "3F 1318\n입찰·협정 평가실", kind: "hall", floor: "3F", x: 58, y: 14, w: 28, h: 14 }
    ],
    rooms: [
      { name: "장공관 1층 총무팀", use: "입찰참가서류 방문 제출처로 확인된 행정 구역" },
      { name: "장공관 3층 1318 회의실", use: "평가회·제안발표·협정식 장소로 반복 확인된 대회의 공간" }
    ]
  });

  enrichInterior("pilheonInterior", {
    source: "추가 공개 조사: 2025-2, 2026-1 대학원 종합시험 시간표에서 필헌관 2202~2204 시험장, 2207~2210 대기실 확인",
    confirmed: [
      "필헌관 2202, 2203, 2204가 대학원 종합시험 시험장소로 확인",
      "필헌관 2207은 교육대학원 대기장소로 확인",
      "필헌관 2208은 정신분석대학원 대기장소로 확인",
      "필헌관 2209, 2210은 일반대학원 대기장소로 확인"
    ],
    zones: [
      { id: "pilheon-2202", label: "2202\n종합시험실", kind: "lecture", floor: "2F", x: 50, y: 46, w: 13, h: 10 },
      { id: "pilheon-2203", label: "2203\n종합시험실", kind: "lecture", floor: "2F", x: 64, y: 46, w: 13, h: 10 },
      { id: "pilheon-2204", label: "2204\n종합시험실", kind: "lecture", floor: "2F", x: 78, y: 46, w: 13, h: 10 },
      { id: "pilheon-2207", label: "2207\n교육대학원 대기", kind: "support", floor: "2F", x: 50, y: 60, w: 13, h: 10 },
      { id: "pilheon-2208", label: "2208\n정신분석 대기", kind: "support", floor: "2F", x: 64, y: 60, w: 13, h: 10 },
      { id: "pilheon-2209", label: "2209\n일반대학원 대기", kind: "support", floor: "2F", x: 78, y: 60, w: 13, h: 10 },
      { id: "pilheon-2210", label: "2210\n일반대학원 대기", kind: "support", floor: "2F", x: 78, y: 72, w: 13, h: 9 }
    ],
    rooms: [
      { name: "필헌관 2202·2203·2204", use: "대학원 종합시험 시험실로 확인된 2층 강의실군" },
      { name: "필헌관 2207·2208·2209·2210", use: "대학원별 시험 대기실로 확인된 지원 공간" }
    ]
  });

  enrichInterior("gyeongsamInterior", {
    source: "추가 공개 조사: 공식 도서관 안내의 지하 1층·지상 3층 연혁과, 현행 공지의 중앙도서관 4층 소극장·경삼관 4층 학생복지팀/장애학생지원센터 위치를 함께 반영",
    confirmed: [
      "공식 도서관 안내에서 오산 중앙도서관은 지상 3층 지하 1층, 장서 30만권 규모로 확인",
      "취업특강 공지에서 중앙도서관 4층 소극장 확인",
      "국제학생증 안내에서 학생복지팀은 경삼관 4층으로 확인",
      "장애학생지원센터 안내에서 경삼관 4층 학생복지팀 내 위치 확인"
    ],
    zones: [
      { id: "gyeongsam-b1-official", label: "B1\n도서관 지하층", kind: "library", floor: "B1", x: 18, y: 86, w: 40, h: 8 },
      { id: "gyeongsam-4f-small-theater", label: "4F 중앙도서관\n소극장", kind: "hall", floor: "4F", x: 60, y: 12, w: 28, h: 10 },
      { id: "gyeongsam-4f-student-team", label: "4F 학생복지팀\n국제학생증", kind: "office", floor: "4F", x: 12, y: 24, w: 28, h: 10 }
    ],
    rooms: [
      { name: "중앙도서관 4층 소극장", use: "취업특강 장소로 확인된 4층 행사 공간" },
      { name: "경삼관 4층 학생복지팀", use: "국제학생증 및 장애학생지원센터 위치 근거가 겹치는 4층 행정 구역" },
      { name: "중앙도서관 B1", use: "공식 도서관 연혁에서 확인되는 지하층" }
    ]
  });

  enrichInterior("joonhaInterior", {
    source: "추가 공개 조사: 전공/센터/공지 페이지에서 장준하통일관 18313, 18421-1, 18423, 18517, 18522 호실 확인",
    confirmed: [
      "한신아동발달상담연구센터 오시는 길에서 장준하통일관 3층 18313호 확인",
      "AI시스템반도체전공, 정보통신학과, 미디어영상광고홍보학부, 첨단융합계열 공지에서 18421-1호 행정실/대학행정팀C 반복 확인",
      "SW중심대학 자료에서 장준하통일관 18423호 사무실 확인",
      "AI·SW 취업특강 및 동아시아통상 문화제 공지에서 18517호 행사·강의 공간 확인",
      "AI 모의면접 안내에서 18522호 후속 면접 공간 확인"
    ],
    zones: [
      { id: "joonha-child-counsel-18313", label: "3F 18313\n한아연 상담센터", kind: "support", floor: "3F", x: 20, y: 20, w: 34, h: 18 },
      { id: "joonha-floor3-counsel-wait", label: "3F 상담 대기\n예약 방문 동선", kind: "lobby", floor: "3F", x: 58, y: 20, w: 24, h: 18 },
      { id: "joonha-ai-interview-18522", label: "5F 18522\nAI 모의면접", kind: "lab", floor: "5F", x: 66, y: 48, w: 22, h: 13 }
    ],
    rooms: [
      { name: "장준하통일관 3층 18313호", use: "한신아동발달상담연구센터 위치로 확인된 상담·예약 방문 공간" },
      { name: "장준하통일관 18421-1호", use: "AI시스템반도체·정보통신·미디어영상광고홍보·첨단융합 관련 행정실로 반복 확인된 4층 행정 구역" },
      { name: "장준하통일관 18522호", use: "AI 모의면접 후속 진행 장소로 확인된 5층 실습형 공간" }
    ]
  });

  enrichInterior("haeoreumInterior", {
    source: "추가 공개 조사: 심리아동학부 교육실 소개에서 해오름관 17205 음악실습실 확인",
    confirmed: [
      "심리아동학부 음악실습실 위치가 해오름관(제3강의동) 17205로 확인"
    ],
    zones: [
      { id: "haeoreum-music-17205", label: "17205\n음악실습실", kind: "lab", floor: "2F", x: 14, y: 40, w: 28, h: 16 }
    ],
    rooms: [
      { name: "해오름관 17205 음악실습실", use: "심리아동학부 교육실 소개에서 확인된 2층 실습 공간" }
    ]
  });

  enrichInterior("seongbinInterior", {
    source: "추가 공개 조사: 생활관 편의점 임대 공지에서 성빈학사 지상 2층 편의점 150㎡ 확인",
    confirmed: [
      "생활관(성빈학사) 편의점 임대업체 선정 공지에서 편의점 위치가 생활관 지상 2층, 면적 150㎡로 확인"
    ],
    zones: [
      { id: "seongbin-2f-store-150", label: "지상 2F\n편의점 150㎡", kind: "cafe", floor: "공용", x: 68, y: 86, w: 24, h: 8 }
    ],
    rooms: [
      { name: "성빈학사 지상 2층 편의점", use: "임대 공지에서 면적 150㎡까지 확인된 공용 복지 공간" }
    ]
  });

  setFootprints("janggongInterior", [
    { label: "본관 중앙 매스", kind: "main", x: 18, y: 27, w: 64, h: 30 },
    { label: "서측 돌출동", kind: "wing", x: 7, y: 31, w: 15, h: 28 },
    { label: "동측 돌출동", kind: "wing", x: 78, y: 31, w: 15, h: 28 },
    { label: "중앙 현관", kind: "entry", x: 35, y: 59, w: 30, h: 12 },
    { label: "전면 광장", kind: "outside", x: 17, y: 73, w: 66, h: 12 },
    { label: "방문 주차", kind: "outside", x: 22, y: 87, w: 56, h: 7 }
  ]);

  setFootprints("pilheonInterior", [
    { label: "대학원 본동", kind: "main", x: 18, y: 29, w: 64, h: 28 },
    { label: "중앙 계단 코어", kind: "courtyard", x: 44, y: 25, w: 12, h: 36 },
    { label: "전면 출입부", kind: "entry", x: 40, y: 60, w: 20, h: 10 },
    { label: "앞마당", kind: "outside", x: 14, y: 74, w: 72, h: 12 }
  ]);

  setFootprints("manwooInterior", [
    { label: "긴 강의동 본체", kind: "main", x: 14, y: 30, w: 70, h: 25 },
    { label: "서측 구관", kind: "wing", x: 5, y: 27, w: 18, h: 31 },
    { label: "남측 돌출동", kind: "wing", x: 36, y: 58, w: 28, h: 20 },
    { label: "외부 복도축", kind: "bridge", x: 15, y: 56, w: 68, h: 5 },
    { label: "전면 포장마당", kind: "outside", x: 13, y: 78, w: 72, h: 12 }
  ]);

  setFootprints("shalomInterior", [
    { label: "채플 예배당", kind: "main", shape: "chapel", x: 19, y: 25, w: 58, h: 38 },
    { label: "전면 포치", kind: "entry", x: 38, y: 64, w: 24, h: 12 },
    { label: "4106 사무동", kind: "wing", x: 73, y: 34, w: 14, h: 22 },
    { label: "B1 기단", kind: "wing", x: 15, y: 22, w: 66, h: 46 },
    { label: "채플 광장", kind: "outside", x: 18, y: 78, w: 64, h: 13 }
  ]);

  setFootprints("immanuelInterior", [
    { label: "학생회관 본동", kind: "main", x: 16, y: 28, w: 68, h: 30 },
    { label: "지하 기단", kind: "wing", x: 12, y: 25, w: 76, h: 36 },
    { label: "식당 전면", kind: "entry", x: 28, y: 61, w: 44, h: 10 },
    { label: "편의점/주방 라인", kind: "wing", x: 12, y: 61, w: 18, h: 10 },
    { label: "학생광장", kind: "outside", x: 12, y: 75, w: 76, h: 14 }
  ]);

  setFootprints("gyeongsamInterior", [
    { label: "도서관 본체", kind: "main", x: 18, y: 25, w: 60, h: 38 },
    { label: "동측 로비동", kind: "wing", x: 76, y: 29, w: 14, h: 30 },
    { label: "후면 서고 매스", kind: "wing", x: 22, y: 12, w: 44, h: 16 },
    { label: "전면 아트리움", kind: "atrium", x: 41, y: 62, w: 18, h: 12 },
    { label: "도서관 광장", kind: "outside", x: 15, y: 77, w: 70, h: 13 }
  ]);

  setFootprints("songamInterior", [
    { label: "유사홀 본체", kind: "main", x: 19, y: 27, w: 55, h: 36 },
    { label: "무대 돌출부", kind: "wing", x: 34, y: 15, w: 28, h: 14 },
    { label: "7108 실습동측", kind: "wing", x: 72, y: 30, w: 16, h: 32 },
    { label: "전면 로비", kind: "entry", x: 33, y: 64, w: 31, h: 11 },
    { label: "버스정류/광장", kind: "outside", x: 17, y: 79, w: 70, h: 12 }
  ]);

  setFootprints("sotongInterior", [
    { label: "교수연구 본동", kind: "main", x: 25, y: 25, w: 55, h: 42 },
    { label: "서측 계단 코어", kind: "wing", x: 13, y: 23, w: 14, h: 46 },
    { label: "1F 박물관/수장고", kind: "wing", x: 30, y: 67, w: 28, h: 14 },
    { label: "중앙 현관", kind: "entry", x: 43, y: 70, w: 20, h: 9 },
    { label: "전면 서비스로", kind: "outside", x: 20, y: 82, w: 66, h: 8 }
  ]);

  setFootprints("practiceInterior", [
    { label: "실습동 본체", kind: "main", x: 18, y: 28, w: 58, h: 36 },
    { label: "창업지원 돌출동", kind: "wing", x: 72, y: 31, w: 18, h: 28 },
    { label: "서비스 베이", kind: "entry", x: 24, y: 64, w: 24, h: 10 },
    { label: "작업마당", kind: "yard", x: 14, y: 77, w: 72, h: 12 },
    { label: "동측 진입로", kind: "outside", x: 62, y: 89, w: 30, h: 6 }
  ]);

  setFootprints("hanulInterior", [
    { label: "체육관 대공간", kind: "main", x: 17, y: 22, w: 66, h: 48 },
    { label: "서측 락커/사무", kind: "wing", x: 5, y: 28, w: 15, h: 36 },
    { label: "동측 장비/서비스", kind: "wing", x: 81, y: 31, w: 13, h: 32 },
    { label: "전면 로비/단상", kind: "entry", x: 32, y: 70, w: 36, h: 12 },
    { label: "운동장 방향 광장", kind: "outside", x: 9, y: 84, w: 82, h: 10 }
  ]);

  setFootprints("seongbinInterior", [
    { label: "제1생활관", kind: "main", x: 8, y: 25, w: 29, h: 38 },
    { label: "제2생활관 중앙", kind: "main", x: 39, y: 27, w: 26, h: 35 },
    { label: "제2생활관 우측", kind: "main", x: 66, y: 27, w: 24, h: 35 },
    { label: "식당/공용 코어", kind: "entry", x: 32, y: 63, w: 22, h: 17 },
    { label: "연결동", kind: "bridge", x: 54, y: 65, w: 20, h: 11 },
    { label: "생활관 마당", kind: "outside", x: 6, y: 82, w: 88, h: 10 }
  ]);

  setFootprints("saeromInterior", [
    { label: "영상문화관 1F", kind: "main", x: 23, y: 34, w: 48, h: 30 },
    { label: "2F 카페 매스", kind: "wing", x: 29, y: 22, w: 42, h: 24 },
    { label: "카페 테라스", kind: "entry", x: 31, y: 64, w: 38, h: 10 },
    { label: "한신공원 광장", kind: "outside", x: 18, y: 77, w: 64, h: 13 }
  ]);

  setFootprints("haeoreumInterior", [
    { label: "제3강의동 본체", kind: "main", x: 19, y: 25, w: 58, h: 38 },
    { label: "서측 계단 코어", kind: "wing", x: 8, y: 23, w: 13, h: 42 },
    { label: "동측 연구실동", kind: "wing", x: 75, y: 29, w: 15, h: 32 },
    { label: "전면 서비스 라인", kind: "entry", x: 28, y: 65, w: 42, h: 10 },
    { label: "전면 광장", kind: "outside", x: 14, y: 78, w: 72, h: 12 }
  ]);

  setFootprints("joonhaInterior", [
    { label: "통일관 본체 5F", kind: "main", x: 18, y: 25, w: 60, h: 42 },
    { label: "동측 회의동", kind: "wing", x: 75, y: 28, w: 15, h: 36 },
    { label: "1F 기념 로비", kind: "entry", x: 28, y: 67, w: 34, h: 10 },
    { label: "중정/기념정원", kind: "courtyard", shape: "round", x: 43, y: 39, w: 16, h: 17 },
    { label: "돌베개 공원", kind: "outside", x: 12, y: 80, w: 76, h: 12 },
    { label: "동측 진입로", kind: "outside", x: 62, y: 92, w: 28, h: 5 }
  ]);

  setFootprints("neutbomInterior", [
    { label: "B1-5F 강의동", kind: "main", x: 17, y: 26, w: 62, h: 38 },
    { label: "동측 수직코어", kind: "wing", x: 76, y: 23, w: 14, h: 43 },
    { label: "저층 기단", kind: "wing", x: 13, y: 63, w: 70, h: 12 },
    { label: "보행 캐노피", kind: "entry", x: 28, y: 76, w: 32, h: 8 },
    { label: "만우관 연결 보행축", kind: "bridge", x: 14, y: 86, w: 72, h: 7 }
  ]);

  setFootprints("childcareInterior", [
    { label: "어린이집 본동", kind: "main", x: 18, y: 25, w: 58, h: 38 },
    { label: "소강당/활동동", kind: "wing", x: 73, y: 31, w: 17, h: 29 },
    { label: "안전 현관", kind: "entry", x: 36, y: 64, w: 32, h: 10 },
    { label: "모래놀이터", kind: "yard", x: 16, y: 78, w: 55, h: 13 },
    { label: "자연학습마당", kind: "yard", x: 72, y: 78, w: 20, h: 10 }
  ]);
}());
