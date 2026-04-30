export const MSG_WELCOME =
  "Привет! Я помогу тебе рассчитать дневную норму калорий и макронутриентов. Ответь на несколько вопросов, и мы начнём.";

export const MSG_ASK_SEX =
  "Укажи пол: мужской или женский.\nПример: мужской";

export const MSG_REASK_SEX =
  "Не понял пол. Напиши «мужской» или «женский».\nПример: мужской";

export const MSG_ASK_AGE =
  "Сколько тебе лет?\nПример: 30";

export const MSG_REASK_AGE =
  "Возраст должен быть от 10 до 120 лет. Напиши число.\nПример: 30";

export const MSG_ASK_HEIGHT =
  "Какой у тебя рост в сантиметрах?\nПример: 175";

export const MSG_REASK_HEIGHT =
  "Рост должен быть от 100 до 250 см. Напиши число.\nПример: 175";

export const MSG_ASK_WEIGHT =
  "Какой у тебя вес в килограммах?\nПример: 70";

export const MSG_REASK_WEIGHT =
  "Вес должен быть от 20 до 300 кг. Напиши число.\nПример: 70";

export const MSG_ASK_ACTIVITY_LEVEL =
  "Какой у тебя уровень активности?\n— малоподвижный\n— лёгкий\n— умеренный\n— активный\n— очень активный\nПример: умеренный";

export const MSG_REASK_ACTIVITY_LEVEL =
  "Не понял уровень активности. Выбери один:\n— малоподвижный\n— лёгкий\n— умеренный\n— активный\n— очень активный\nПример: умеренный";

export const MSG_ASK_WEIGHT_GOAL =
  "Какая у тебя цель?\n— похудеть\n— удержать\n— набрать\nПример: похудеть";

export const MSG_REASK_WEIGHT_GOAL =
  "Не понял цель. Выбери одну:\n— похудеть\n— удержать\n— набрать\nПример: похудеть";

export const MSG_ASK_PACE =
  "С какой скоростью ты хочешь менять вес (кг в неделю)? Можно пропустить — тогда подставлю 0,5 кг/неделю.\nПример: 0.5 или пропусти";

export const MSG_REASK_PACE =
  "Скорость должна быть от 0,1 до 2,0 кг/неделю. Напиши число или пропусти.\nПример: 0.5";

export const MSG_DEFAULT_PACE_DISCLOSED =
  "Ок, подставляю скорость по умолчанию: 0,5 кг/неделю — умеренный темп, не агрессивный.";

export const MSG_ASK_TIMEZONE =
  "В каком часовом поясе ты находишься? Укажи IANA-идентификатор.\nПример: Europe/Moscow";

export const MSG_REASK_TIMEZONE =
  "Не понял часовой пояс. Укажи в формате Регион/Город.\nПример: Europe/Moscow";

export const MSG_ASK_REPORT_TIME =
  "В какое время тебе удобно получать дневной отчёт? Укажи в формате ЧЧ:ММ.\nПример: 21:00";

export const MSG_REASK_REPORT_TIME =
  "Время должно быть в формате ЧЧ:ММ (00:00–23:59).\nПример: 21:00";

export const MSG_TARGET_SUMMARY = (
  calories: number,
  protein: number,
  fat: number,
  carbs: number,
  goalLabel: string
): string =>
  `Вот твоя дневная цель (цель: ${goalLabel}):\n` +
  `— Калории: ${calories} ккал\n` +
  `— Белки: ${protein} г\n` +
  `— Жиры: ${fat} г\n` +
  `— Углеводы: ${carbs} г`;

export const MSG_DISCLAIMER =
  "Это не медицинская рекомендация, а оценочный расчёт по формуле Миффлина-Сан-Жеора. При сомнениях проконсультируйся с врачом.";

export const MSG_CONFIRM_TARGET =
  "Подтверждаешь эти цели? Напиши «да» для подтверждения.";

export const MSG_ONBOARDING_COMPLETE =
  "Отлично! Профиль создан, теперь можешь записывать приёмы пищи.";

export const MSG_STEP_RESUMED = (stepLabel: string): string =>
  `Продолжаем настройку. ${stepLabel}`;

export const ACTIVITY_LEVEL_LABELS: Record<string, string> = {
  sedentary: "малоподвижный",
  light: "лёгкий",
  moderate: "умеренный",
  active: "активный",
  very_active: "очень активный",
};

export const WEIGHT_GOAL_LABELS: Record<string, string> = {
  lose: "похудеть",
  maintain: "удержать",
  gain: "набрать",
};

export const STEP_PROMPTS: Record<string, string> = {
  sex: MSG_ASK_SEX,
  age: MSG_ASK_AGE,
  height: MSG_ASK_HEIGHT,
  weight: MSG_ASK_WEIGHT,
  activity_level: MSG_ASK_ACTIVITY_LEVEL,
  weight_goal: MSG_ASK_WEIGHT_GOAL,
  pace: MSG_ASK_PACE,
  timezone: MSG_ASK_TIMEZONE,
  report_time: MSG_ASK_REPORT_TIME,
  target_confirmation: "",
};

export const STEP_REASKS: Record<string, string> = {
  sex: MSG_REASK_SEX,
  age: MSG_REASK_AGE,
  height: MSG_REASK_HEIGHT,
  weight: MSG_REASK_WEIGHT,
  activity_level: MSG_REASK_ACTIVITY_LEVEL,
  weight_goal: MSG_REASK_WEIGHT_GOAL,
  pace: MSG_REASK_PACE,
  timezone: MSG_REASK_TIMEZONE,
  report_time: MSG_REASK_REPORT_TIME,
};

const RU_SEX_MAP: Record<string, string> = {
  мужской: "male",
  муж: "male",
  м: "male",
  женский: "female",
  жен: "female",
  ж: "female",
};

const RU_ACTIVITY_MAP: Record<string, string> = {
  малоподвижный: "sedentary",
  лёгкий: "light",
  легкий: "light",
  умеренный: "moderate",
  активный: "active",
  "очень активный": "very_active",
};

const RU_GOAL_MAP: Record<string, string> = {
  похудеть: "lose",
  удержать: "maintain",
  набрать: "gain",
};

export function parseSex(input: string): string | null {
  const normalized = input.trim().toLowerCase();
  return RU_SEX_MAP[normalized] ?? null;
}

export function parseActivityLevel(input: string): string | null {
  const normalized = input.trim().toLowerCase();
  return RU_ACTIVITY_MAP[normalized] ?? null;
}

export function parseWeightGoal(input: string): string | null {
  const normalized = input.trim().toLowerCase();
  return RU_GOAL_MAP[normalized] ?? null;
}
