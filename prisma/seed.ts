import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import {
  AlternativeType,
  Difficulty,
  EquipmentCategory,
  ExerciseMovementType,
  PrismaClient,
  WorkoutBodyPart,
} from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

// ============================================================
// EQUIPMENT
// ============================================================

const equipments = [
  {
    name: "덤벨",
    category: EquipmentCategory.FREE_WEIGHT,
    description: "한 손 또는 양손으로 사용하는 프리웨이트",
  },
  {
    name: "바벨",
    category: EquipmentCategory.FREE_WEIGHT,
    description: "양손으로 사용하는 대표적인 프리웨이트",
  },
  {
    name: "EZ바",
    category: EquipmentCategory.FREE_WEIGHT,
    description: "손목 부담을 줄이기 위한 곡선형 바벨",
  },
  {
    name: "케틀벨",
    category: EquipmentCategory.FREE_WEIGHT,
    description: "스윙 및 전신 운동에 사용하는 웨이트",
  },
  {
    name: "스미스머신",
    category: EquipmentCategory.MACHINE,
    description: "바벨의 이동을 가이드하는 머신",
  },
  {
    name: "레그프레스 머신",
    category: EquipmentCategory.MACHINE,
    description: "하체 근육을 사용하는 대표적인 머신",
  },
  {
    name: "레그익스텐션 머신",
    category: EquipmentCategory.MACHINE,
    description: "대퇴사두근을 집중적으로 사용하는 머신",
  },
  {
    name: "레그컬 머신",
    category: EquipmentCategory.MACHINE,
    description: "햄스트링을 집중적으로 사용하는 머신",
  },
  {
    name: "체스트프레스 머신",
    category: EquipmentCategory.MACHINE,
    description: "가슴 근육을 사용하는 머신",
  },
  {
    name: "숄더프레스 머신",
    category: EquipmentCategory.MACHINE,
    description: "어깨 근육을 사용하는 머신",
  },
  {
    name: "어시스트 풀업 머신",
    category: EquipmentCategory.MACHINE,
    description: "풀업을 보조해주는 머신",
  },
  {
    name: "케이블 머신",
    category: EquipmentCategory.CABLE,
    description: "다양한 각도에서 저항을 제공하는 케이블 머신",
  },
  {
    name: "랫풀다운 머신",
    category: EquipmentCategory.MACHINE,
    description: "등 근육을 사용하는 상체 머신",
  },
  {
    name: "트레드밀",
    category: EquipmentCategory.CARDIO,
    description: "걷기와 달리기를 위한 유산소 머신",
  },
  {
    name: "사이클",
    category: EquipmentCategory.CARDIO,
    description: "실내 자전거 형태의 유산소 머신",
  },
  {
    name: "스텝밀",
    category: EquipmentCategory.CARDIO,
    description: "계단 오르기 방식의 유산소 머신",
  },
  {
    name: "맨몸",
    category: EquipmentCategory.BODYWEIGHT,
    description: "별도의 장비 없이 체중을 이용하는 운동",
  },
  {
    name: "탄력 밴드",
    category: EquipmentCategory.BAND,
    description: "저항을 제공하는 탄력 밴드",
  },
  {
    name: "미니 밴드",
    category: EquipmentCategory.BAND,
    description: "둔근 및 하체 활성화에 사용하는 미니 밴드",
  },
  {
    name: "벤치",
    category: EquipmentCategory.OTHER,
    description: "다양한 웨이트 운동에 사용하는 벤치",
  },
];

// ============================================================
// EXERCISE
// ============================================================

const exercises = [
  // ----------------------------------------------------------
  // CHEST
  // ----------------------------------------------------------

  {
    name: "벤치프레스",
    bodyPart: WorkoutBodyPart.CHEST,
    targetMuscle: "대흉근",
    movementType: ExerciseMovementType.PUSH,
    difficulty: Difficulty.INTERMEDIATE,
    description: "바벨을 이용해 가슴 근육을 주로 사용하는 대표적인 운동",
    instruction:
      "벤치에 누워 바벨을 가슴 중앙으로 내린 후 가슴의 힘으로 밀어 올립니다.",
    breathing: "바벨을 내릴 때 들이마시고 밀어 올릴 때 내쉽니다.",
    caution: "어깨가 과도하게 들리지 않도록 하고 손목을 중립으로 유지합니다.",
    equipment: ["바벨", "벤치"],
  },

  {
    name: "덤벨 벤치프레스",
    bodyPart: WorkoutBodyPart.CHEST,
    targetMuscle: "대흉근",
    movementType: ExerciseMovementType.PUSH,
    difficulty: Difficulty.INTERMEDIATE,
    description: "덤벨을 이용한 가슴 운동",
    instruction:
      "벤치에 누워 덤벨을 가슴 옆으로 내린 후 위쪽으로 밀어 올립니다.",
    breathing: "내릴 때 들이마시고 올릴 때 내쉽니다.",
    caution: "덤벨이 몸 바깥쪽으로 과도하게 벌어지지 않도록 합니다.",
    equipment: ["덤벨", "벤치"],
  },

  {
    name: "인클라인 덤벨 벤치프레스",
    bodyPart: WorkoutBodyPart.CHEST,
    targetMuscle: "상부 대흉근",
    movementType: ExerciseMovementType.PUSH,
    difficulty: Difficulty.INTERMEDIATE,
    description: "벤치 각도를 높여 상부 가슴을 집중적으로 사용하는 운동",
    instruction:
      "인클라인 벤치에 누워 덤벨을 가슴 위쪽 방향으로 밀어 올립니다.",
    breathing: "내릴 때 들이마시고 올릴 때 내쉽니다.",
    caution: "허리를 과도하게 꺾지 않습니다.",
    equipment: ["덤벨", "벤치"],
  },

  {
    name: "스미스 벤치프레스",
    bodyPart: WorkoutBodyPart.CHEST,
    targetMuscle: "대흉근",
    movementType: ExerciseMovementType.PUSH,
    difficulty: Difficulty.INTERMEDIATE,
    description: "스미스머신을 이용한 벤치프레스",
    instruction:
      "벤치에 누워 바를 가슴 중앙으로 내린 후 안정적으로 밀어 올립니다.",
    breathing: "내릴 때 들이마시고 올릴 때 내쉽니다.",
    caution: "바가 가슴에 과도하게 닿지 않도록 합니다.",
    equipment: ["스미스머신", "벤치"],
  },

  {
    name: "체스트프레스",
    bodyPart: WorkoutBodyPart.CHEST,
    targetMuscle: "대흉근",
    movementType: ExerciseMovementType.PUSH,
    difficulty: Difficulty.BEGINNER,
    description: "머신을 이용해 가슴을 집중적으로 사용하는 운동",
    instruction:
      "가슴을 세우고 손잡이를 앞으로 밀어 가슴을 수축시킵니다.",
    breathing: "밀어낼 때 내쉬고 돌아올 때 들이마십니다.",
    caution: "어깨가 앞으로 과도하게 말리지 않도록 합니다.",
    equipment: ["체스트프레스 머신"],
  },

  {
    name: "케이블 크로스오버",
    bodyPart: WorkoutBodyPart.CHEST,
    targetMuscle: "대흉근",
    movementType: ExerciseMovementType.ISOLATION,
    difficulty: Difficulty.INTERMEDIATE,
    description: "케이블을 이용해 가슴을 수축시키는 운동",
    instruction:
      "양손의 케이블을 몸 앞쪽으로 모으며 가슴을 수축시킵니다.",
    breathing: "팔을 모을 때 내쉽니다.",
    caution: "팔꿈치를 과도하게 굽히거나 펴지 않습니다.",
    equipment: ["케이블 머신"],
  },

  {
    name: "푸쉬업",
    bodyPart: WorkoutBodyPart.CHEST,
    targetMuscle: "대흉근",
    movementType: ExerciseMovementType.PUSH,
    difficulty: Difficulty.BEGINNER,
    description: "체중을 이용한 대표적인 상체 운동",
    instruction:
      "몸을 일직선으로 유지하면서 팔꿈치를 굽혀 가슴을 바닥 가까이 내린 후 밀어 올립니다.",
    breathing: "내려갈 때 들이마시고 올라올 때 내쉽니다.",
    caution: "허리가 꺾이거나 엉덩이가 과도하게 올라가지 않도록 합니다.",
    equipment: ["맨몸"],
  },

  // ----------------------------------------------------------
  // BACK
  // ----------------------------------------------------------

  {
    name: "데드리프트",
    bodyPart: WorkoutBodyPart.BACK,
    targetMuscle: "척추기립근, 둔근, 햄스트링",
    movementType: ExerciseMovementType.HINGE,
    difficulty: Difficulty.ADVANCED,
    description: "전신 후면을 사용하는 대표적인 힙힌지 운동",
    instruction:
      "허리를 중립으로 유지하고 엉덩이를 뒤로 보내 바벨을 들어 올립니다.",
    breathing: "들기 전에 복압을 만들고 들어 올리며 호흡을 유지합니다.",
    caution: "허리가 둥글게 말리지 않도록 합니다.",
    equipment: ["바벨"],
  },

  {
    name: "루마니안 데드리프트",
    bodyPart: WorkoutBodyPart.BACK,
    targetMuscle: "햄스트링, 둔근",
    movementType: ExerciseMovementType.HINGE,
    difficulty: Difficulty.INTERMEDIATE,
    description: "햄스트링과 둔근을 집중적으로 사용하는 힙힌지 운동",
    instruction:
      "무릎을 약간 굽힌 상태에서 엉덩이를 뒤로 보내며 바벨을 내립니다.",
    breathing: "내릴 때 들이마시고 올라올 때 내쉽니다.",
    caution: "허리보다 고관절을 중심으로 움직입니다.",
    equipment: ["바벨"],
  },

  {
    name: "바벨로우",
    bodyPart: WorkoutBodyPart.BACK,
    targetMuscle: "광배근, 능형근",
    movementType: ExerciseMovementType.PULL,
    difficulty: Difficulty.INTERMEDIATE,
    description: "바벨을 당겨 등 근육을 강화하는 운동",
    instruction:
      "상체를 숙인 상태에서 바벨을 복부 방향으로 당깁니다.",
    breathing: "당길 때 내쉽니다.",
    caution: "허리를 과도하게 굽히지 않습니다.",
    equipment: ["바벨"],
  },

  {
    name: "원암 덤벨로우",
    bodyPart: WorkoutBodyPart.BACK,
    targetMuscle: "광배근",
    movementType: ExerciseMovementType.PULL,
    difficulty: Difficulty.BEGINNER,
    description: "한쪽씩 등 근육을 집중적으로 사용하는 운동",
    instruction:
      "벤치에 한 손과 무릎을 지지하고 덤벨을 몸통 방향으로 당깁니다.",
    breathing: "당길 때 내쉽니다.",
    caution: "어깨를 으쓱하지 않고 팔보다 등으로 당깁니다.",
    equipment: ["덤벨", "벤치"],
  },

  {
    name: "랫풀다운",
    bodyPart: WorkoutBodyPart.BACK,
    targetMuscle: "광배근",
    movementType: ExerciseMovementType.PULL,
    difficulty: Difficulty.BEGINNER,
    description: "수직으로 당기는 대표적인 등 운동",
    instruction:
      "가슴을 세우고 바를 가슴 위쪽으로 당긴 후 천천히 돌아갑니다.",
    breathing: "당길 때 내쉬고 돌아갈 때 들이마십니다.",
    caution: "바를 목 뒤로 당기지 않습니다.",
    equipment: ["랫풀다운 머신"],
  },

  {
    name: "시티드 케이블 로우",
    bodyPart: WorkoutBodyPart.BACK,
    targetMuscle: "광배근, 능형근",
    movementType: ExerciseMovementType.PULL,
    difficulty: Difficulty.BEGINNER,
    description: "케이블을 이용한 수평 당기기 운동",
    instruction:
      "상체를 세우고 손잡이를 복부 방향으로 당깁니다.",
    breathing: "당길 때 내쉽니다.",
    caution: "반동을 사용하지 않습니다.",
    equipment: ["케이블 머신"],
  },

  {
    name: "풀업",
    bodyPart: WorkoutBodyPart.BACK,
    targetMuscle: "광배근",
    movementType: ExerciseMovementType.PULL,
    difficulty: Difficulty.ADVANCED,
    description: "체중을 이용한 대표적인 수직 당기기 운동",
    instruction:
      "어깨를 안정화한 후 팔꿈치를 아래로 당기며 몸을 끌어올립니다.",
    breathing: "올라갈 때 내쉽니다.",
    caution: "목을 바에 억지로 가져가지 않습니다.",
    equipment: ["맨몸"],
  },

  {
    name: "어시스트 풀업",
    bodyPart: WorkoutBodyPart.BACK,
    targetMuscle: "광배근",
    movementType: ExerciseMovementType.PULL,
    difficulty: Difficulty.BEGINNER,
    description: "머신의 도움을 받아 수행하는 풀업",
    instruction:
      "보조 패드의 도움을 받으며 광배근을 사용해 몸을 끌어올립니다.",
    breathing: "올라갈 때 내쉽니다.",
    caution: "반동을 최소화합니다.",
    equipment: ["어시스트 풀업 머신"],
  },

  // ----------------------------------------------------------
  // SHOULDER
  // ----------------------------------------------------------

  {
    name: "바벨 숄더프레스",
    bodyPart: WorkoutBodyPart.SHOULDER,
    targetMuscle: "삼각근",
    movementType: ExerciseMovementType.PUSH,
    difficulty: Difficulty.INTERMEDIATE,
    description: "바벨을 이용한 대표적인 어깨 운동",
    instruction:
      "바벨을 어깨 높이에서 시작해 머리 위로 밀어 올립니다.",
    breathing: "밀어 올릴 때 내쉽니다.",
    caution: "허리를 과도하게 꺾지 않습니다.",
    equipment: ["바벨"],
  },

  {
    name: "덤벨 숄더프레스",
    bodyPart: WorkoutBodyPart.SHOULDER,
    targetMuscle: "삼각근",
    movementType: ExerciseMovementType.PUSH,
    difficulty: Difficulty.BEGINNER,
    description: "덤벨을 이용한 어깨 프레스 운동",
    instruction:
      "덤벨을 어깨 높이에 위치시키고 위로 밀어 올립니다.",
    breathing: "올릴 때 내쉽니다.",
    caution: "덤벨을 너무 낮게 내리지 않습니다.",
    equipment: ["덤벨"],
  },

  {
    name: "머신 숄더프레스",
    bodyPart: WorkoutBodyPart.SHOULDER,
    targetMuscle: "삼각근",
    movementType: ExerciseMovementType.PUSH,
    difficulty: Difficulty.BEGINNER,
    description: "머신을 이용한 어깨 프레스",
    instruction:
      "등을 패드에 붙이고 손잡이를 위로 밀어 올립니다.",
    breathing: "밀어낼 때 내쉽니다.",
    caution: "어깨 통증이 발생하면 가동범위를 줄입니다.",
    equipment: ["숄더프레스 머신"],
  },

  {
    name: "덤벨 레터럴레이즈",
    bodyPart: WorkoutBodyPart.SHOULDER,
    targetMuscle: "측면 삼각근",
    movementType: ExerciseMovementType.ISOLATION,
    difficulty: Difficulty.BEGINNER,
    description: "측면 삼각근을 집중적으로 사용하는 운동",
    instruction:
      "팔꿈치를 살짝 굽힌 상태에서 덤벨을 옆으로 들어 올립니다.",
    breathing: "올릴 때 내쉽니다.",
    caution: "반동을 사용하지 않습니다.",
    equipment: ["덤벨"],
  },

  {
    name: "프론트레이즈",
    bodyPart: WorkoutBodyPart.SHOULDER,
    targetMuscle: "전면 삼각근",
    movementType: ExerciseMovementType.ISOLATION,
    difficulty: Difficulty.BEGINNER,
    description: "전면 삼각근을 사용하는 운동",
    instruction:
      "덤벨을 몸 앞쪽으로 어깨 높이까지 들어 올립니다.",
    breathing: "올릴 때 내쉽니다.",
    caution: "어깨보다 높게 과도하게 들어 올리지 않습니다.",
    equipment: ["덤벨"],
  },

  {
    name: "리어델트 플라이",
    bodyPart: WorkoutBodyPart.SHOULDER,
    targetMuscle: "후면 삼각근",
    movementType: ExerciseMovementType.ISOLATION,
    difficulty: Difficulty.BEGINNER,
    description: "후면 삼각근을 집중적으로 사용하는 운동",
    instruction:
      "상체를 숙이고 팔을 양옆으로 벌립니다.",
    breathing: "벌릴 때 내쉽니다.",
    caution: "승모근으로 들어 올리지 않도록 합니다.",
    equipment: ["덤벨"],
  },

  // ----------------------------------------------------------
  // BICEPS
  // ----------------------------------------------------------

  {
    name: "바벨컬",
    bodyPart: WorkoutBodyPart.ARM,
    targetMuscle: "이두근",
    movementType: ExerciseMovementType.ISOLATION,
    difficulty: Difficulty.BEGINNER,
    description: "바벨을 이용한 이두근 운동",
    instruction:
      "팔꿈치를 고정하고 바벨을 위로 들어 올립니다.",
    breathing: "올릴 때 내쉽니다.",
    caution: "몸을 흔들어 반동을 사용하지 않습니다.",
    equipment: ["바벨"],
  },

  {
    name: "덤벨컬",
    bodyPart: WorkoutBodyPart.ARM,
    targetMuscle: "이두근",
    movementType: ExerciseMovementType.ISOLATION,
    difficulty: Difficulty.BEGINNER,
    description: "덤벨을 이용한 이두근 운동",
    instruction:
      "팔꿈치를 몸통 옆에 고정하고 덤벨을 들어 올립니다.",
    breathing: "올릴 때 내쉽니다.",
    caution: "팔꿈치가 앞으로 움직이지 않도록 합니다.",
    equipment: ["덤벨"],
  },

  {
    name: "해머컬",
    bodyPart: WorkoutBodyPart.ARM,
    targetMuscle: "상완근, 이두근",
    movementType: ExerciseMovementType.ISOLATION,
    difficulty: Difficulty.BEGINNER,
    description: "중립 그립으로 수행하는 이두근 운동",
    instruction:
      "손바닥이 서로 마주 보도록 덤벨을 잡고 들어 올립니다.",
    breathing: "올릴 때 내쉽니다.",
    caution: "손목을 꺾지 않습니다.",
    equipment: ["덤벨"],
  },

  {
    name: "케이블 컬",
    bodyPart: WorkoutBodyPart.ARM,
    targetMuscle: "이두근",
    movementType: ExerciseMovementType.ISOLATION,
    difficulty: Difficulty.BEGINNER,
    description: "케이블의 지속적인 저항을 이용한 이두근 운동",
    instruction:
      "팔꿈치를 고정하고 케이블 손잡이를 몸 쪽으로 당깁니다.",
    breathing: "당길 때 내쉽니다.",
    caution: "반동을 사용하지 않습니다.",
    equipment: ["케이블 머신"],
  },

  // ----------------------------------------------------------
  // TRICEPS
  // ----------------------------------------------------------

  {
    name: "트라이셉스 푸시다운",
    bodyPart: WorkoutBodyPart.ARM,
    targetMuscle: "삼두근",
    movementType: ExerciseMovementType.ISOLATION,
    difficulty: Difficulty.BEGINNER,
    description: "케이블을 이용한 대표적인 삼두근 운동",
    instruction:
      "팔꿈치를 몸통에 고정하고 손잡이를 아래로 밀어냅니다.",
    breathing: "밀어낼 때 내쉽니다.",
    caution: "팔꿈치가 앞뒤로 움직이지 않도록 합니다.",
    equipment: ["케이블 머신"],
  },

  {
    name: "오버헤드 트라이셉스 익스텐션",
    bodyPart: WorkoutBodyPart.ARM,
    targetMuscle: "삼두근",
    movementType: ExerciseMovementType.ISOLATION,
    difficulty: Difficulty.INTERMEDIATE,
    description: "삼두근을 머리 위에서 늘려 사용하는 운동",
    instruction:
      "덤벨을 머리 뒤로 내렸다가 팔꿈치를 펴면서 들어 올립니다.",
    breathing: "올릴 때 내쉽니다.",
    caution: "팔꿈치가 과도하게 벌어지지 않도록 합니다.",
    equipment: ["덤벨"],
  },

  {
    name: "덤벨 킥백",
    bodyPart: WorkoutBodyPart.ARM,
    targetMuscle: "삼두근",
    movementType: ExerciseMovementType.ISOLATION,
    difficulty: Difficulty.BEGINNER,
    description: "덤벨을 이용한 삼두근 고립 운동",
    instruction:
      "상체를 숙이고 팔꿈치를 고정한 상태에서 팔을 뒤로 펴냅니다.",
    breathing: "팔을 펼 때 내쉽니다.",
    caution: "팔꿈치를 고정합니다.",
    equipment: ["덤벨"],
  },

  // ----------------------------------------------------------
  // LEGS
  // ----------------------------------------------------------

  {
    name: "백스쿼트",
    bodyPart: WorkoutBodyPart.LEG,
    targetMuscle: "대퇴사두근, 둔근",
    movementType: ExerciseMovementType.SQUAT,
    difficulty: Difficulty.INTERMEDIATE,
    description: "바벨을 등에 올리고 수행하는 대표적인 하체 운동",
    instruction:
      "엉덩이를 뒤로 보내면서 앉았다가 발바닥으로 바닥을 밀며 일어납니다.",
    breathing: "내려가기 전에 들이마시고 올라오며 내쉽니다.",
    caution: "무릎과 발끝 방향을 일치시킵니다.",
    equipment: ["바벨"],
  },

  {
    name: "프론트스쿼트",
    bodyPart: WorkoutBodyPart.LEG,
    targetMuscle: "대퇴사두근",
    movementType: ExerciseMovementType.SQUAT,
    difficulty: Difficulty.ADVANCED,
    description: "바벨을 앞쪽에 위치시켜 수행하는 스쿼트",
    instruction:
      "바벨을 어깨 앞쪽에 위치시키고 상체를 세운 상태에서 앉았다 일어납니다.",
    breathing: "내려가기 전에 들이마시고 올라오며 내쉽니다.",
    caution: "상체가 과도하게 앞으로 기울지 않도록 합니다.",
    equipment: ["바벨"],
  },

  {
    name: "덤벨 고블릿 스쿼트",
    bodyPart: WorkoutBodyPart.LEG,
    targetMuscle: "대퇴사두근, 둔근",
    movementType: ExerciseMovementType.SQUAT,
    difficulty: Difficulty.BEGINNER,
    description: "덤벨을 가슴 앞에서 들고 수행하는 스쿼트",
    instruction:
      "덤벨을 가슴 앞에 들고 엉덩이를 아래로 내려 스쿼트를 수행합니다.",
    breathing: "내려갈 때 들이마시고 올라올 때 내쉽니다.",
    caution: "발뒤꿈치가 들리지 않도록 합니다.",
    equipment: ["덤벨"],
  },

  {
    name: "스미스 스쿼트",
    bodyPart: WorkoutBodyPart.LEG,
    targetMuscle: "대퇴사두근, 둔근",
    movementType: ExerciseMovementType.SQUAT,
    difficulty: Difficulty.BEGINNER,
    description: "스미스머신을 이용한 스쿼트",
    instruction:
      "바벨의 이동 궤도를 활용해 안정적으로 스쿼트를 수행합니다.",
    breathing: "내려갈 때 들이마시고 올라올 때 내쉽니다.",
    caution: "발 위치에 따라 무릎과 허리 부담이 달라질 수 있습니다.",
    equipment: ["스미스머신"],
  },

  {
    name: "레그프레스",
    bodyPart: WorkoutBodyPart.LEG,
    targetMuscle: "대퇴사두근, 둔근",
    movementType: ExerciseMovementType.PUSH,
    difficulty: Difficulty.BEGINNER,
    description: "머신을 이용해 하체를 밀어내는 운동",
    instruction:
      "발판을 발 전체로 밀어내며 무릎을 펴고 다시 천천히 굽힙니다.",
    breathing: "밀어낼 때 내쉽니다.",
    caution: "무릎을 완전히 잠그지 않습니다.",
    equipment: ["레그프레스 머신"],
  },

  {
    name: "레그익스텐션",
    bodyPart: WorkoutBodyPart.LEG,
    targetMuscle: "대퇴사두근",
    movementType: ExerciseMovementType.ISOLATION,
    difficulty: Difficulty.BEGINNER,
    description: "대퇴사두근을 집중적으로 사용하는 머신 운동",
    instruction:
      "패드에 정강이를 고정하고 무릎을 펴 올립니다.",
    breathing: "올릴 때 내쉽니다.",
    caution: "무게를 과도하게 높이지 않습니다.",
    equipment: ["레그익스텐션 머신"],
  },

  {
    name: "레그컬",
    bodyPart: WorkoutBodyPart.LEG,
    targetMuscle: "햄스트링",
    movementType: ExerciseMovementType.ISOLATION,
    difficulty: Difficulty.BEGINNER,
    description: "햄스트링을 집중적으로 사용하는 운동",
    instruction:
      "패드에 다리를 고정하고 무릎을 굽혀 발뒤꿈치를 엉덩이 방향으로 당깁니다.",
    breathing: "당길 때 내쉽니다.",
    caution: "허리를 과도하게 들지 않습니다.",
    equipment: ["레그컬 머신"],
  },

  {
    name: "불가리안 스플릿 스쿼트",
    bodyPart: WorkoutBodyPart.LEG,
    targetMuscle: "대퇴사두근, 둔근",
    movementType: ExerciseMovementType.LUNGE,
    difficulty: Difficulty.INTERMEDIATE,
    description: "한쪽 다리씩 수행하는 하체 운동",
    instruction:
      "뒷발을 벤치에 올리고 앞쪽 다리 중심으로 앉았다 일어납니다.",
    breathing: "내려갈 때 들이마시고 올라올 때 내쉽니다.",
    caution: "앞쪽 무릎이 안쪽으로 무너지지 않도록 합니다.",
    equipment: ["덤벨", "벤치"],
  },

  // ----------------------------------------------------------
  // GLUTE
  // ----------------------------------------------------------

  {
    name: "바벨 힙쓰러스트",
    bodyPart: WorkoutBodyPart.GLUTE,
    targetMuscle: "대둔근",
    movementType: ExerciseMovementType.HINGE,
    difficulty: Difficulty.INTERMEDIATE,
    description: "둔근을 집중적으로 사용하는 대표적인 운동",
    instruction:
      "등 상부를 벤치에 지지하고 바벨을 골반에 올린 뒤 엉덩이를 들어 올립니다.",
    breathing: "올릴 때 내쉽니다.",
    caution: "허리를 과도하게 꺾지 않고 엉덩이로 들어 올립니다.",
    equipment: ["바벨", "벤치"],
  },

  {
    name: "덤벨 힙쓰러스트",
    bodyPart: WorkoutBodyPart.GLUTE,
    targetMuscle: "대둔근",
    movementType: ExerciseMovementType.HINGE,
    difficulty: Difficulty.BEGINNER,
    description: "덤벨을 이용한 힙쓰러스트",
    instruction:
      "덤벨을 골반 위에 올리고 엉덩이를 들어 올립니다.",
    breathing: "올릴 때 내쉽니다.",
    caution: "허리로 움직이지 않습니다.",
    equipment: ["덤벨", "벤치"],
  },

  {
    name: "글루트 브릿지",
    bodyPart: WorkoutBodyPart.GLUTE,
    targetMuscle: "대둔근",
    movementType: ExerciseMovementType.HINGE,
    difficulty: Difficulty.BEGINNER,
    description: "맨몸으로 수행하는 둔근 운동",
    instruction:
      "바닥에 누워 무릎을 굽힌 상태에서 엉덩이를 들어 올립니다.",
    breathing: "올릴 때 내쉽니다.",
    caution: "허리를 과도하게 꺾지 않습니다.",
    equipment: ["맨몸"],
  },

  {
    name: "미니밴드 사이드 워크",
    bodyPart: WorkoutBodyPart.GLUTE,
    targetMuscle: "중둔근",
    movementType: ExerciseMovementType.ISOLATION,
    difficulty: Difficulty.BEGINNER,
    description: "미니밴드를 이용해 둔근을 활성화하는 운동",
    instruction:
      "무릎 또는 발목에 밴드를 착용하고 옆으로 천천히 이동합니다.",
    breathing: "자연스럽게 호흡합니다.",
    caution: "무릎이 안쪽으로 무너지지 않도록 합니다.",
    equipment: ["미니 밴드"],
  },

  // ----------------------------------------------------------
  // ABS
  // ----------------------------------------------------------

  {
    name: "크런치",
    bodyPart: WorkoutBodyPart.ABS,
    targetMuscle: "복직근",
    movementType: ExerciseMovementType.ISOLATION,
    difficulty: Difficulty.BEGINNER,
    description: "복직근을 집중적으로 사용하는 복근 운동",
    instruction:
      "복부를 수축하며 상체를 살짝 들어 올립니다.",
    breathing: "올라올 때 내쉽니다.",
    caution: "목을 당겨서 올라오지 않습니다.",
    equipment: ["맨몸"],
  },

  {
    name: "리버스 크런치",
    bodyPart: WorkoutBodyPart.ABS,
    targetMuscle: "복직근",
    movementType: ExerciseMovementType.ISOLATION,
    difficulty: Difficulty.BEGINNER,
    description: "하체를 이용해 복부를 수축하는 운동",
    instruction:
      "무릎을 가슴 방향으로 당기며 골반을 살짝 들어 올립니다.",
    breathing: "당길 때 내쉽니다.",
    caution: "반동을 사용하지 않습니다.",
    equipment: ["맨몸"],
  },

  {
    name: "플랭크",
    bodyPart: WorkoutBodyPart.ABS,
    targetMuscle: "복직근, 복횡근",
    movementType: ExerciseMovementType.OTHER,
    difficulty: Difficulty.BEGINNER,
    description: "코어를 등척성으로 강화하는 운동",
    instruction:
      "팔꿈치와 발끝으로 몸을 지지하고 몸 전체를 일직선으로 유지합니다.",
    breathing: "자연스럽고 일정하게 호흡합니다.",
    caution: "허리가 꺾이지 않도록 합니다.",
    equipment: ["맨몸"],
  },

  {
    name: "사이드 플랭크",
    bodyPart: WorkoutBodyPart.ABS,
    targetMuscle: "복사근",
    movementType: ExerciseMovementType.OTHER,
    difficulty: Difficulty.BEGINNER,
    description: "측면 코어를 강화하는 운동",
    instruction:
      "한쪽 팔꿈치와 발로 몸을 지지하고 몸을 일직선으로 유지합니다.",
    breathing: "자연스럽게 호흡합니다.",
    caution: "골반이 바닥으로 떨어지지 않도록 합니다.",
    equipment: ["맨몸"],
  },

  // ----------------------------------------------------------
  // FULL BODY
  // ----------------------------------------------------------

  {
    name: "케틀벨 스윙",
    bodyPart: WorkoutBodyPart.FULL_BODY,
    targetMuscle: "둔근, 햄스트링",
    movementType: ExerciseMovementType.HINGE,
    difficulty: Difficulty.INTERMEDIATE,
    description: "고관절의 폭발적인 움직임을 사용하는 전신 운동",
    instruction:
      "고관절을 접었다가 펴는 힘으로 케틀벨을 가슴 높이까지 흔듭니다.",
    breathing: "케틀벨을 올리며 강하게 내쉽니다.",
    caution: "팔로 들어 올리지 않고 고관절 힘을 사용합니다.",
    equipment: ["케틀벨"],
  },

  {
    name: "덤벨 스쿼트 투 프레스",
    bodyPart: WorkoutBodyPart.FULL_BODY,
    targetMuscle: "하체, 어깨",
    movementType: ExerciseMovementType.SQUAT,
    difficulty: Difficulty.INTERMEDIATE,
    description: "스쿼트와 숄더프레스를 결합한 전신 운동",
    instruction:
      "스쿼트로 내려갔다가 일어나면서 덤벨을 머리 위로 밀어 올립니다.",
    breathing: "일어나며 밀어 올릴 때 내쉽니다.",
    caution: "허리를 과도하게 꺾지 않습니다.",
    equipment: ["덤벨"],
  },

  // ----------------------------------------------------------
  // CARDIO
  // ----------------------------------------------------------

  {
    name: "트레드밀 걷기",
    bodyPart: WorkoutBodyPart.CARDIO,
    targetMuscle: "전신",
    movementType: ExerciseMovementType.CARDIO,
    difficulty: Difficulty.BEGINNER,
    description: "트레드밀에서 수행하는 저강도 유산소 운동",
    instruction:
      "자신에게 맞는 속도로 걷고 일정한 보폭을 유지합니다.",
    breathing: "자연스럽게 호흡합니다.",
    caution: "속도를 무리하게 높이지 않습니다.",
    equipment: ["트레드밀"],
  },

  {
    name: "트레드밀 러닝",
    bodyPart: WorkoutBodyPart.CARDIO,
    targetMuscle: "전신",
    movementType: ExerciseMovementType.CARDIO,
    difficulty: Difficulty.INTERMEDIATE,
    description: "트레드밀에서 수행하는 달리기",
    instruction:
      "자신에게 맞는 속도로 일정한 페이스를 유지하며 달립니다.",
    breathing: "일정한 리듬으로 호흡합니다.",
    caution: "무릎이나 발목에 통증이 발생하면 중단합니다.",
    equipment: ["트레드밀"],
  },

  {
    name: "실내 사이클",
    bodyPart: WorkoutBodyPart.CARDIO,
    targetMuscle: "하체",
    movementType: ExerciseMovementType.CARDIO,
    difficulty: Difficulty.BEGINNER,
    description: "실내 자전거를 이용한 유산소 운동",
    instruction:
      "안장 높이를 조절하고 일정한 페이스로 페달을 밟습니다.",
    breathing: "자연스럽게 호흡합니다.",
    caution: "무릎이 과도하게 펴지지 않도록 안장 높이를 조절합니다.",
    equipment: ["사이클"],
  },

  {
    name: "스텝밀",
    bodyPart: WorkoutBodyPart.CARDIO,
    targetMuscle: "하체",
    movementType: ExerciseMovementType.CARDIO,
    difficulty: Difficulty.INTERMEDIATE,
    description: "계단 오르기 방식의 유산소 운동",
    instruction:
      "일정한 속도로 계단을 오르며 하체를 사용합니다.",
    breathing: "일정한 리듬으로 호흡합니다.",
    caution: "손잡이에 체중을 과도하게 싣지 않습니다.",
    equipment: ["스텝밀"],
  },
];

// ============================================================
// WORKOUT ALTERNATIVE
// ============================================================

const alternatives = [
  {
    from: "벤치프레스",
    to: "덤벨 벤치프레스",
    type: AlternativeType.EQUIPMENT_ALTERNATIVE,
    priority: 1,
    reason:
      "바벨 대신 덤벨을 사용해 좌우 독립적인 움직임으로 수행할 수 있습니다.",
  },

  {
    from: "벤치프레스",
    to: "체스트프레스",
    type: AlternativeType.EQUIPMENT_ALTERNATIVE,
    priority: 2,
    reason:
      "머신을 이용해 보다 안정적으로 가슴 운동을 수행할 수 있습니다.",
  },

  {
    from: "벤치프레스",
    to: "푸쉬업",
    type: AlternativeType.EQUIPMENT_ALTERNATIVE,
    priority: 3,
    reason:
      "장비 없이 체중을 이용해 가슴 운동을 수행할 수 있습니다.",
  },

  {
    from: "데드리프트",
    to: "루마니안 데드리프트",
    type: AlternativeType.SAME_MOVEMENT,
    priority: 1,
    reason:
      "후면 사슬을 집중적으로 사용하는 힙힌지 운동으로 대체할 수 있습니다.",
  },

  {
    from: "풀업",
    to: "어시스트 풀업",
    type: AlternativeType.DIFFICULTY_ALTERNATIVE,
    priority: 1,
    reason:
      "머신의 도움을 받아 풀업 난이도를 낮출 수 있습니다.",
  },

  {
    from: "풀업",
    to: "랫풀다운",
    type: AlternativeType.DIFFICULTY_ALTERNATIVE,
    priority: 2,
    reason:
      "머신을 이용해 수직 당기기 동작을 수행할 수 있습니다.",
  },

  {
    from: "백스쿼트",
    to: "스미스 스쿼트",
    type: AlternativeType.EQUIPMENT_ALTERNATIVE,
    priority: 1,
    reason:
      "스미스머신을 이용해 바벨의 이동을 안정적으로 제어할 수 있습니다.",
  },

  {
    from: "백스쿼트",
    to: "덤벨 고블릿 스쿼트",
    type: AlternativeType.DIFFICULTY_ALTERNATIVE,
    priority: 2,
    reason:
      "덤벨 하나를 사용해 스쿼트 동작을 보다 쉽게 수행할 수 있습니다.",
  },

  {
    from: "백스쿼트",
    to: "레그프레스",
    type: AlternativeType.EQUIPMENT_ALTERNATIVE,
    priority: 3,
    reason:
      "머신을 이용해 하체를 밀어내는 방식으로 대체할 수 있습니다.",
  },

  {
    from: "바벨 힙쓰러스트",
    to: "덤벨 힙쓰러스트",
    type: AlternativeType.EQUIPMENT_ALTERNATIVE,
    priority: 1,
    reason:
      "바벨 대신 덤벨을 사용해 둔근 운동을 수행할 수 있습니다.",
  },

  {
    from: "바벨 힙쓰러스트",
    to: "글루트 브릿지",
    type: AlternativeType.DIFFICULTY_ALTERNATIVE,
    priority: 2,
    reason:
      "장비 없이 둔근을 강화할 수 있습니다.",
  },
];

// ============================================================
// SEED
// ============================================================

async function main() {
  console.log("🌱 FitNote seed started...\n");

  // ==========================================================
  // 1. Equipment
  // ==========================================================

  const equipmentMap = new Map<string, string>();

  for (const equipment of equipments) {
    const result = await prisma.equipment.upsert({
      where: {
        name: equipment.name,
      },

      update: {
        category: equipment.category,
        description: equipment.description,
        isSystem: true,
        isActive: true,
      },

      create: {
        name: equipment.name,
        category: equipment.category,
        description: equipment.description,
        isSystem: true,
        isActive: true,
      },
    });

    equipmentMap.set(result.name, result.id);
  }

  console.log(`✅ Equipment seeded: ${equipmentMap.size}`);

  // ==========================================================
  // 2. Exercise
  // ==========================================================

  const exerciseMap = new Map<string, string>();

  for (const exercise of exercises) {
    const result = await prisma.exercise.upsert({
      where: {
        name: exercise.name,
      },

      update: {
        bodyPart: exercise.bodyPart,
        targetMuscle: exercise.targetMuscle,
        movementType: exercise.movementType,
        difficulty: exercise.difficulty,
        description: exercise.description,
        instruction: exercise.instruction,
        breathing: exercise.breathing,
        caution: exercise.caution,
        isSystem: true,
        isActive: true,
      },

      create: {
        name: exercise.name,
        bodyPart: exercise.bodyPart,
        targetMuscle: exercise.targetMuscle,
        movementType: exercise.movementType,
        difficulty: exercise.difficulty,
        description: exercise.description,
        instruction: exercise.instruction,
        breathing: exercise.breathing,
        caution: exercise.caution,
        isSystem: true,
        isActive: true,
      },
    });

    exerciseMap.set(result.name, result.id);

    // --------------------------------------------------------
    // Exercise ↔ Equipment
    // 배열의 첫 번째 장비를 해당 운동의 핵심 장비(primary)로 본다.
    // 예: 벤치프레스 = ["바벨"(primary), "벤치"(보조)]
    // --------------------------------------------------------

    for (const [index, equipmentName] of exercise.equipment.entries()) {
      const equipmentId = equipmentMap.get(equipmentName);

      if (!equipmentId) {
        throw new Error(
          `Equipment not found: "${equipmentName}" for exercise "${exercise.name}"`,
        );
      }

      const isPrimary = index === 0;

      await prisma.exerciseEquipment.upsert({
        where: {
          exerciseId_equipmentId: {
            exerciseId: result.id,
            equipmentId,
          },
        },

        update: {
          isPrimary,
        },

        create: {
          exerciseId: result.id,
          equipmentId,
          isPrimary,
        },
      });
    }
  }

  console.log(`✅ Exercise seeded: ${exerciseMap.size}`);

  // ==========================================================
  // 3. Workout Alternative
  // ==========================================================

  let alternativeCount = 0;

  for (const alternative of alternatives) {
    const exerciseId = exerciseMap.get(alternative.from);
    const alternativeExerciseId = exerciseMap.get(alternative.to);

    if (!exerciseId) {
      throw new Error(
        `Source exercise not found: "${alternative.from}"`,
      );
    }

    if (!alternativeExerciseId) {
      throw new Error(
        `Alternative exercise not found: "${alternative.to}"`,
      );
    }

    await prisma.workoutAlternative.upsert({
      where: {
        exerciseId_alternativeExerciseId: {
          exerciseId,
          alternativeExerciseId,
        },
      },

      update: {
        type: alternative.type,
        priority: alternative.priority,
        reason: alternative.reason,
      },

      create: {
        exerciseId,
        alternativeExerciseId,
        type: alternative.type,
        priority: alternative.priority,
        reason: alternative.reason,
      },
    });

    alternativeCount++;
  }

  console.log(
    `✅ Workout alternatives seeded: ${alternativeCount}`,
  );

  // ==========================================================
  // 4. Summary
  // ==========================================================

  const equipmentCount = await prisma.equipment.count({
    where: {
      isSystem: true,
    },
  });

  const exerciseCount = await prisma.exercise.count({
    where: {
      isSystem: true,
    },
  });

  const exerciseEquipmentCount =
    await prisma.exerciseEquipment.count();

  const workoutAlternativeCount =
    await prisma.workoutAlternative.count();

  console.log("\n========================================");
  console.log("🎉 FitNote seed completed!");
  console.log("========================================");
  console.log(`Equipment:           ${equipmentCount}`);
  console.log(`Exercise:            ${exerciseCount}`);
  console.log(`ExerciseEquipment:   ${exerciseEquipmentCount}`);
  console.log(`WorkoutAlternative:  ${workoutAlternativeCount}`);
  console.log("========================================\n");
}

// ============================================================
// EXECUTE
// ============================================================

main()
  .catch((error) => {
    console.error("\n❌ Seed failed:");
    console.error(error);

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });