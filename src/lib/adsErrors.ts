/**
 * Turns a platform's error into something a shop owner can act on.
 *
 * Meta and TikTok answer in engineer's English — "Invalid parameter", "(#200)
 * Requires permission" — and we were storing that verbatim. A customer read it,
 * understood nothing, and asked us; we read it and knew little more, because the
 * sentence names no cause and suggests no fix.
 *
 * So every message here carries three parts: WHAT went wrong, WHY, and WHAT TO
 * DO. In both languages, because the store is used in both.
 *
 * It maps already-stored strings too, not just fresh failures — old campaigns
 * carry raw platform text and deserve the same explanation.
 */

export type AdErrorCode =
  | "post_not_promotable"
  | "post_not_found"
  | "post_unpublished"
  | "bad_post_url"
  | "page_token_dead"
  | "missing_permission"
  | "ad_account_disabled"
  | "special_ad_category"
  | "budget_too_low"
  | "payment_method"
  | "audience_too_narrow"
  | "launch_timeout"
  | "wallet_empty"
  | "unknown";

export interface AdErrorText {
  code: AdErrorCode;
  /** One line: what happened. */
  title: string;
  /** Why it happened, in plain words. */
  body: string;
  /** The next action the owner can actually take. */
  fix: string;
}

type Entry = { ar: Omit<AdErrorText, "code">; en: Omit<AdErrorText, "code"> };

export const AD_ERRORS: Record<AdErrorCode, Entry> = {
  post_not_promotable: {
    ar: {
      title: "فيسبوك لا يسمح بالإعلان عن هذا المنشور",
      body: "المنشور موجود ومنشور، لكن فيسبوك يرفض تحويله إلى إعلان. السبب غالباً قيد على الصفحة نفسها، أو محتوى في المنشور يخالف سياسة الإعلانات.",
      fix: "جرّب منشوراً آخر من القائمة. إن رُفض هو الآخر فالقيد على الصفحة: افتح إعدادات الصفحة ← «جودة الحساب / Account Quality» وسيظهر السبب والاعتراض.",
    },
    en: {
      title: "Facebook will not let this post be advertised",
      body: "The post exists and is published, but Facebook refuses to turn it into an ad — usually a restriction on the Page itself, or content that breaks the advertising policy.",
      fix: "Try another post from the list. If that is refused too, the restriction is on the Page: open Page Settings → Account Quality, where the reason and the appeal are shown.",
    },
  },
  post_not_found: {
    ar: {
      title: "المنشور غير موجود في هذه الصفحة",
      body: "الرابط لا يشير إلى منشور في الصفحة المختارة — غالباً نُسخ من صفحة أخرى، أو حُذف المنشور.",
      fix: "اختر المنشور من القائمة بدل لصق الرابط، أو تأكّد أن الرابط يخصّ نفس الصفحة.",
    },
    en: {
      title: "That post is not on this Page",
      body: "The link does not point to a post on the selected Page — it was probably copied from a different Page, or the post was deleted.",
      fix: "Pick the post from the list instead of pasting a link, or check the link belongs to the same Page.",
    },
  },
  post_unpublished: {
    ar: {
      title: "المنشور غير منشور",
      body: "المنشور ما زال مسودّة أو مجدولاً أو مخفياً، ولا يمكن الإعلان عن منشور لا يراه الناس.",
      fix: "انشر المنشور على الصفحة أولاً ثم أعد المحاولة.",
    },
    en: {
      title: "The post is not published",
      body: "It is still a draft, scheduled, or hidden — and a post nobody can see cannot be advertised.",
      fix: "Publish it on the Page first, then try again.",
    },
  },
  bad_post_url: {
    ar: {
      title: "رابط المنشور غير صالح",
      body: "تعذّر استخراج رقم المنشور من الرابط المُدخل.",
      fix: "انسخ الرابط من زر «نسخ الرابط» على المنشور نفسه، أو اختره من القائمة.",
    },
    en: {
      title: "The post link is not valid",
      body: "We could not read a post id out of the link you entered.",
      fix: "Copy the link from the post's own Copy link button, or pick it from the list.",
    },
  },
  page_token_dead: {
    ar: {
      title: "انتهت صلاحية ربط الصفحة",
      body: "تغيّرت كلمة مرور فيسبوك أو أُلغي الإذن، فلم يعد بإمكاننا التصرّف نيابة عن الصفحة.",
      fix: "أعد ربط الصفحة من صفحة الإعلانات، ثم أعد المحاولة. لن يُخصم منك شيء قبل ذلك.",
    },
    en: {
      title: "The Page connection has expired",
      body: "A Facebook password change or a revoked permission means we can no longer act for this Page.",
      fix: "Reconnect the Page from the Ads screen, then try again. Nothing is charged until it works.",
    },
  },
  missing_permission: {
    ar: {
      title: "صلاحية ناقصة على الصفحة",
      body: "حسابك لا يملك صلاحية إدارة الإعلانات على هذه الصفحة.",
      fix: "تأكّد أنك مدير الصفحة، ثم أعد ربطها مع الموافقة على كل الأذونات المطلوبة.",
    },
    en: {
      title: "A Page permission is missing",
      body: "Your account does not have ad-management rights on this Page.",
      fix: "Make sure you are a Page admin, then reconnect it and accept every permission requested.",
    },
  },
  ad_account_disabled: {
    ar: {
      title: "الحساب الإعلاني موقوف",
      body: "أوقفت ميتا الحساب الإعلاني المستخدم لإطلاق الحملات، فلا يمكن إنشاء أي إعلان حالياً.",
      fix: "هذه ليست مشكلة في صفحتك — تواصل معنا وسنتابعها مع ميتا. لم يُخصم منك شيء.",
    },
    en: {
      title: "The ad account is disabled",
      body: "Meta has disabled the ad account used to run campaigns, so no ad can be created right now.",
      fix: "This is not a problem with your Page — contact us and we will take it up with Meta. You have not been charged.",
    },
  },
  special_ad_category: {
    ar: {
      title: "المنشور يحتاج تصنيف إعلان خاص",
      body: "ميتا تصنّف إعلانات السكن أو التوظيف أو الائتمان ضمن فئة خاصة لها قواعد استهداف مختلفة.",
      fix: "اختر الفئة الخاصة المناسبة عند إنشاء الحملة، أو استخدم منشوراً لا يدخل في هذه الفئات.",
    },
    en: {
      title: "This needs a special ad category",
      body: "Meta classifies housing, employment and credit ads as a special category with different targeting rules.",
      fix: "Pick the matching special category when creating the campaign, or use a post that does not fall into one.",
    },
  },
  budget_too_low: {
    ar: {
      title: "الميزانية أقل من الحد الأدنى",
      body: "المنصّة ترفض الحملة لأن ميزانيتها اليومية أقل مما تسمح به.",
      fix: "ارفع الميزانية أو قلّل عدد الأيام — الباقات الجاهزة في الصفحة مضبوطة على الحد الأدنى أصلاً.",
    },
    en: {
      title: "The budget is below the minimum",
      body: "The platform refuses the campaign because its daily budget is under what it allows.",
      fix: "Raise the budget or shorten the run — the ready-made packages on the page already sit at the minimum.",
    },
  },
  payment_method: {
    ar: {
      title: "مشكلة في وسيلة الدفع لدى المنصّة",
      body: "رفضت المنصّة وسيلة الدفع المرتبطة بالحساب الإعلاني.",
      fix: "هذه من طرفنا لا من طرفك — تواصل معنا. لم يُخصم منك شيء.",
    },
    en: {
      title: "A payment problem on the platform",
      body: "The platform rejected the payment method attached to the ad account.",
      fix: "This is on our side, not yours — contact us. You have not been charged.",
    },
  },
  audience_too_narrow: {
    ar: {
      title: "الجمهور المستهدَف ضيّق جداً",
      body: "عدد من تنطبق عليهم شروط الاستهداف أقل من أن تعمل عليه حملة.",
      fix: "وسّع نطاق المدينة، أو زِد الفئة العمرية، أو احذف بعض الاهتمامات.",
    },
    en: {
      title: "The audience is too narrow",
      body: "Too few people match the targeting for a campaign to run.",
      fix: "Widen the city radius, broaden the age range, or remove some interests.",
    },
  },
  launch_timeout: {
    ar: {
      title: "لم تبدأ الحملة في الوقت المتوقع",
      body: "تم الدفع لكن المنصّة لم تستجب خلال ساعة، فأُلغيت الحملة تلقائياً حتى لا يبقى المبلغ محجوزاً.",
      fix: "أُعيد المبلغ إلى محفظتك. أعد إنشاء الحملة متى شئت.",
    },
    en: {
      title: "The campaign did not start in time",
      body: "Payment went through but the platform did not respond within an hour, so the campaign was cancelled automatically rather than leaving your money held.",
      fix: "The amount is back in your wallet. Create the campaign again whenever you like.",
    },
  },
  wallet_empty: {
    ar: {
      title: "رصيد المحفظة لا يكفي",
      body: "توقفت الحملة المستمرة لأن الخصم اليومي لم يجد رصيداً.",
      fix: "اشحن محفظتك ثم اضغط «استئناف» على الحملة.",
    },
    en: {
      title: "Not enough wallet balance",
      body: "The continuous campaign paused because the daily charge found no balance.",
      fix: "Top up your wallet, then press Resume on the campaign.",
    },
  },
  unknown: {
    ar: {
      title: "تعذّر إطلاق الحملة",
      body: "ردّت المنصّة بخطأ لم نتمكن من ترجمته إلى سبب واضح.",
      fix: "أعد المحاولة، وإن تكرّر أرسل لنا نصّ الخطأ كما هو وسنتابعه.",
    },
    en: {
      title: "The campaign could not be launched",
      body: "The platform returned an error we could not translate into a clear cause.",
      fix: "Try again; if it repeats, send us the error text as-is and we will look into it.",
    },
  },
};

/** Ordered: the first pattern that matches wins, so specific rules come first. */
const RULES: Array<{ code: AdErrorCode; test: RegExp }> = [
  { code: "launch_timeout",      test: /لم تبدأ الحملة خلال ساعة|did not start in time/i },
  { code: "wallet_empty",        test: /نفاد رصيد|insufficient_balance|رصيد المحفظة/i },
  { code: "post_not_promotable", test: /not eligible|ineligible|غير قابل للترويج|لا يسمح بالإعلان/i },
  { code: "post_unpublished",    test: /غير منشور|not published|unpublished/i },
  { code: "post_not_found",      test: /لم يُعثر على هذا المنشور|does not exist|nonexisting|not found|#803/i },
  { code: "bad_post_url",        test: /رقم المنشور|post id|extract/i },
  { code: "page_token_dead",     test: /رمز الصفحة|invalidat|session has been|expired|\(#190\)|\b190\/460\b/i },
  { code: "missing_permission",  test: /\(#200\)|requires .*permission|permission/i },
  { code: "ad_account_disabled", test: /ad account.*(disabl|unavailable)|#2654|account is disabled/i },
  { code: "special_ad_category", test: /special ad categor|#1885183/i },
  { code: "payment_method",      test: /funding source|payment method|#2655/i },
  { code: "budget_too_low",      test: /minimum budget|budget.*too low|below_minimum|الحد الأدنى/i },
  { code: "audience_too_narrow", test: /audience.*(small|narrow)|too narrow/i },
];

export function classifyAdError(raw: string | null | undefined): AdErrorCode {
  const s = (raw || "").trim();
  if (!s) return "unknown";
  for (const r of RULES) if (r.test.test(s)) return r.code;
  return "unknown";
}

/**
 * The explanation to show. `raw` is kept on the side rather than hidden: when
 * the cause is "unknown" the platform's own words are the only real information
 * we have, and dropping them would leave the owner with nothing to report.
 */
export function explainAdError(
  raw: string | null | undefined,
  lang: "ar" | "en" = "ar",
): AdErrorText & { raw: string } {
  const code = classifyAdError(raw);
  const e = AD_ERRORS[code][lang];
  return { code, ...e, raw: (raw || "").trim() };
}
