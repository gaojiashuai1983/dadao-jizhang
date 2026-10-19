/* 内置类目 + 可选图标 */

export const TYPE_EXPENSE = 'expense';
export const TYPE_INCOME = 'income';

export const TYPE_LABEL = {
  expense: '支出',
  income: '收入'
};

/** 内置支出类目（参考日常记账习惯整理） */
export const DEFAULT_EXPENSE = [
  { name: '餐饮', icon: '🍴' },
  { name: '交通', icon: '🚌' },
  { name: '蔬菜', icon: '🥬' },
  { name: '水果', icon: '🍎' },
  { name: '零食', icon: '🍰' },
  { name: '运动', icon: '🏃' },
  { name: '娱乐', icon: '🎮' },
  { name: '通讯', icon: '📱' },
  { name: '服饰', icon: '👕' },
  { name: '美容', icon: '💅' },
  { name: '住房', icon: '🏠' },
  { name: '居家', icon: '🛋️' },
  { name: '孩子', icon: '🧒' },
  { name: '长辈', icon: '👴' },
  { name: '社交', icon: '💬' },
  { name: '旅行', icon: '✈️' },
  { name: '烟酒', icon: '🍷' },
  { name: '数码', icon: '💻' },
  { name: '汽车', icon: '🚗' },
  { name: '医疗', icon: '💊' },
  { name: '书籍', icon: '📖' },
  { name: '学习', icon: '🎓' },
  { name: '维修', icon: '🔧' },
  { name: '亲友', icon: '🧑‍🤝‍🧑' },
  { name: '购物', icon: '🛍️' },
  { name: '咖啡', icon: '☕' },
  { name: '损失', icon: '💸' },
  { name: '其他', icon: '📦' }
];

/** 内置收入类目 */
export const DEFAULT_INCOME = [
  { name: '工资', icon: '💰' },
  { name: '兼职', icon: '💼' },
  { name: '理财', icon: '📈' },
  { name: '车库房租', icon: '🏘️' },
  { name: '礼金', icon: '🧧' },
  { name: '卖二手', icon: '📤' },
  { name: '差旅补贴', icon: '🧳' },
  { name: '退税', icon: '🧾' },
  { name: '公积金', icon: '🏦' },
  { name: '其他', icon: '📦' }
];

/** 自定义类目可选的图标 */
export const ICON_CHOICES = [
  '🍴', '🍜', '🍚', '🍔', '🍕', '🍰', '🍦', '☕', '🍵', '🍺', '🍷', '🧋',
  '🥬', '🍎', '🥩', '🐟', '🥚', '🍞', '🛒', '🛍️', '🎁', '🧧', '💳', '💰',
  '🚌', '🚇', '🚕', '🚗', '🚲', '🛵', '⛽', '✈️', '🚄', '🚢', '🅿️', '🛣️',
  '🏠', '🛋️', '🪑', '🧹', '🧺', '🔧', '🔨', '💡', '🚿', '🛏️', '🧴', '🗑️',
  '👕', '👟', '👗', '👜', '🕶️', '💄', '💅', '💇', '🧴', '💍', '👶', '🧒',
  '👴', '👵', '🧑‍🤝‍🧑', '💬', '📞', '📱', '💻', '⌨️', '🖥️', '🎧', '📷', '🔋',
  '🏃', '⚽', '🏀', '🎾', '🏊', '🚴', '🥊', '🧘', '🎮', '🎬', '🎤', '🎨',
  '📖', '📚', '🎓', '✏️', '💊', '🏥', '🩺', '💉', '🐶', '🐱', '🌻', '🎂',
  '📈', '📉', '🏦', '🧾', '📤', '📥', '💼', '🧳', '📦', '💸', '🎰', '🪙',
  '⭐', '❤️', '🔥', '🌙', '☀️', '🎯', '🔔', '📌', '🧧', '🀄', '🎵', '🏆'
];

export function defaultCategories(type) {
  const list = type === TYPE_INCOME ? DEFAULT_INCOME : DEFAULT_EXPENSE;
  return list.map((c, i) => ({
    id: `${type}_${i}`,
    type,
    name: c.name,
    icon: c.icon,
    order: i,
    builtin: true
  }));
}
