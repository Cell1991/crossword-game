import os
from typing import Optional, Set

class DictionaryService:
    """Configurable and pluggable dictionary validation service."""

    def __init__(self, custom_words: Optional[Set[str]] = None, wordlist_file: Optional[str] = None):
        self._words: Set[str] = set()
        if custom_words:
            self._words.update(w.upper().strip() for w in custom_words)
        
        if not wordlist_file:
            env_path = os.getenv("WORDLIST_PATH")
            candidates = [
                env_path,
                os.path.join(os.path.dirname(__file__), "..", "..", "data", "wordlist.txt"),
                os.path.join(os.path.dirname(__file__), "..", "..", "data", "CSW24.txt"),
                os.path.join(os.path.dirname(__file__), "..", "..", "..", "CSW24.txt"),
                os.path.join(os.path.dirname(__file__), "..", "..", "..", "wordlist.txt"),
            ]
            for candidate in candidates:
                if candidate and os.path.exists(candidate):
                    wordlist_file = candidate
                    break

        if wordlist_file and os.path.exists(wordlist_file):
            self.load_from_file(wordlist_file)
        if not self._words:
            self._load_default_wordlist()

    def load_from_file(self, file_path: str) -> None:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                word = line.strip().upper()
                if word and word.isalpha():
                    self._words.add(word)

    def is_valid_word(self, word: str) -> bool:
        if not word or not isinstance(word, str):
            return False
        cleaned = word.strip().upper()
        if len(cleaned) < 2:
            return False
        return cleaned in self._words

    def add_word(self, word: str) -> None:
        if word and word.isalpha():
            self._words.add(word.strip().upper())

    def _load_default_wordlist(self) -> None:
        """Loads an extensive set of valid standard English words."""
        # 2-letter valid scrabble words
        two_letter = [
            "AA", "AB", "AD", "AE", "AG", "AH", "AI", "AL", "AM", "AN", "AR", "AS", "AT", "AW", "AX", "AY",
            "BA", "BE", "BI", "BO", "BY", "CH", "DA", "DE", "DI", "DO", "EA", "ED", "EE", "EF", "EH", "EL",
            "EM", "EN", "ER", "ES", "ET", "EW", "EX", "FA", "FE", "GI", "GO", "HA", "HE", "HI", "HM", "HO",
            "ID", "IF", "IN", "IS", "IT", "JO", "KA", "KI", "LA", "LI", "LO", "MA", "ME", "MI", "MM", "MO",
            "MU", "MY", "NA", "NE", "NO", "NU", "OD", "OE", "OF", "OH", "OI", "OK", "OM", "ON", "OP", "OR",
            "OS", "OW", "OX", "OY", "PA", "PE", "PI", "PO", "QI", "RE", "SH", "SI", "SO", "TA", "TE", "TI",
            "TO", "UH", "UM", "UN", "UP", "US", "UT", "WE", "WO", "XI", "XU", "YA", "YE", "YO", "ZA"
        ]
        self._words.update(two_letter)

        # Core common dictionary words across 3 to 10 letters
        core_words = [
            "THE", "AND", "FOR", "ARE", "BUT", "NOT", "YOU", "ALL", "ANY", "CAN", "HAD", "HER", "WAS", "ONE",
            "OUR", "OUT", "DAY", "GET", "HAS", "HIM", "HIS", "HOW", "MAN", "NEW", "NOW", "OLD", "SEE", "TWO",
            "WAY", "WHO", "BOY", "DID", "ITS", "LET", "PUT", "SAY", "SHE", "TOO", "USE", "ACT", "ADD", "AGE",
            "AGO", "AIR", "ART", "BAD", "BAG", "BAR", "BED", "BIG", "BIT", "BOX", "BUS", "CAR", "CAT", "CUP",
            "CUT", "DOG", "DRY", "EAR", "EAT", "EGG", "END", "EYE", "FAR", "FAT", "FEW", "FIT", "FLY", "FUN",
            "GAS", "GOD", "GUN", "HAT", "HIT", "HOT", "ICE", "ILL", "INK", "JAM", "JAR", "JAW", "JOB", "JOY",
            "KEY", "KID", "LAW", "LAY", "LEG", "LIP", "LOW", "MAP", "MAY", "MUD", "NET", "OIL", "PAY", "PEN",
            "PET", "PIG", "PIN", "POT", "RED", "ROD", "ROW", "RUN", "SAD", "SEA", "SET", "SEW", "SIN", "SIT",
            "SIX", "SKI", "SKY", "SON", "SUN", "TAX", "TEA", "TEN", "TIE", "TIP", "TOE", "TOP", "TOY", "WAR",
            "WET", "WIN", "YES", "YET", "ZOO",
            # 4 letters
            "ABLE", "ACID", "AGED", "ALSO", "AREA", "ARMY", "AWAY", "BABY", "BACK", "BALL", "BAND", "BANK",
            "BASE", "BATH", "BEAR", "BEAT", "BEEN", "BEER", "BELL", "BELT", "BEST", "BIRD", "BLOW", "BLUE",
            "BOAT", "BODY", "BOMB", "BOND", "BONE", "BOOK", "BOOM", "BORN", "BOSS", "BOTH", "BOWL", "BULK",
            "BURN", "BUSH", "BUSY", "CALL", "CALM", "CAME", "CAMP", "CARD", "CARE", "CASE", "CASH", "CAST",
            "CELL", "CHAT", "CHIP", "CITY", "CLUB", "COAL", "COAT", "CODE", "COLD", "COME", "COOK", "COOL",
            "COPE", "COPY", "CORE", "COST", "CREW", "CROP", "DARK", "DATA", "DATE", "DAWN", "DAYS", "DEAD",
            "DEAL", "DEAR", "DEBT", "DEEP", "DENY", "DESK", "DIAL", "DIET", "DISC", "DISK", "DOES", "DONE",
            "DOOR", "DOSE", "DOWN", "DRAW", "DREW", "DROP", "DRUG", "DUAL", "DUKE", "DUST", "DUTY", "EACH",
            "EARN", "EASE", "EAST", "EASY", "EDGE", "ELSE", "EVEN", "EVER", "EVIL", "EXIT", "FACE", "FACT",
            "FAIL", "FAIR", "FALL", "FARM", "FAST", "FATE", "FEAR", "FEED", "FEEL", "FEET", "FELL", "FILE",
            "FILL", "FILM", "FIND", "FINE", "FIRE", "FIRM", "FISH", "FIVE", "FLAT", "FLOW", "FOOD", "FOOT",
            "FORM", "FORT", "FOUR", "FREE", "FROM", "FULL", "FUND", "GAME", "GATE", "GAVE", "GEAR", "GIFT",
            "GIRL", "GIVE", "GLAD", "GOAL", "GOES", "GOLD", "GONE", "GOOD", "GRAY", "GREW", "GROW", "GULF",
            "HAIR", "HALF", "HALL", "HAND", "HANG", "HARD", "HARM", "HATE", "HAVE", "HEAD", "HEAR", "HEAT",
            "HELD", "HELL", "HELP", "HERE", "HERO", "HIGH", "HILL", "HIRE", "HOLD", "HOLE", "HOLY", "HOME",
            "HOPE", "HOST", "HOUR", "HUGE", "HUNG", "HUNT", "HURT", "IDEA", "INCH", "INTO", "IRON", "ITEM",
            "JACK", "JOIN", "JUMP", "JUST", "KEEP", "KEPT", "KICK", "KILL", "KIND", "KING", "KNEE", "KNEW",
            "KNOW", "LACK", "LADY", "LAID", "LAKE", "LAND", "LANE", "LAST", "LATE", "LEAD", "LEFT", "LESS",
            "LIFE", "LIFT", "LIKE", "LINE", "LINK", "LIST", "LIVE", "LOAD", "LOAN", "LOCK", "LOGO", "LONG",
            "LOOK", "LORD", "LOSE", "LOSS", "LOST", "LOVE", "LUCK", "MADE", "MAIL", "MAIN", "MAKE", "MALE",
            "MANY", "MARK", "MASS", "MEAL", "MEAN", "MEAT", "MEET", "MENU", "MILE", "MILK", "MIND", "MINE",
            "MISS", "MODE", "MOOD", "MOON", "MORE", "MOST", "MOVE", "MUCH", "NAME", "NAVY", "NEAR", "NECK",
            "NEED", "NEWS", "NEXT", "NICE", "NINE", "NONE", "NOSE", "NOTE", "OKAY", "ONCE", "ONLY", "OPEN",
            "ORAL", "OVER", "PACE", "PACK", "PAGE", "PAID", "PAIN", "PAIR", "PARK", "PART", "PASS", "PAST",
            "PATH", "PEAK", "PEER", "PICK", "PILE", "PINE", "PINK", "PIPE", "PLAN", "PLAY", "PLOT", "PLUG",
            "PLUS", "POEM", "POET", "POLL", "POOL", "POOR", "PORT", "POST", "PULL", "PURE", "PUSH", "RACE",
            "RAIL", "RAIN", "RANK", "RARE", "RATE", "READ", "REAL", "REAR", "RELY", "RENT", "REST", "RICE",
            "RICH", "RIDE", "RING", "RISE", "RISK", "ROAD", "ROCK", "ROLE", "ROLL", "ROOF", "ROOM", "ROOT",
            "ROSE", "RULE", "RUSH", "SAFE", "SAID", "SAIL", "SALE", "SAME", "SAVE", "SEAT", "SEED", "SEEK",
            "SEEM", "SEEN", "SELF", "SELL", "SEND", "SENT", "SEPT", "SHIP", "SHOP", "SHOT", "SHOW", "SHUT",
            "SICK", "SIDE", "SIGN", "SITE", "SIZE", "SKIN", "SLIP", "SLOW", "SNOW", "SOFT", "SOIL", "SOLD",
            "SOLE", "SOME", "SONG", "SOON", "SORT", "SOUL", "SPOT", "STAR", "STAY", "STEP", "STOP", "SUCH",
            "SUIT", "SURE", "TAKE", "TALE", "TALK", "TALL", "TANK", "TAPE", "TASK", "TEAM", "TECH", "TELL",
            "TEND", "TERM", "TEST", "TEXT", "THAN", "THAT", "THEM", "THEN", "THEY", "THIN", "THIS", "THUS",
            "TIDE", "TILL", "TIME", "TINY", "TOLD", "TOLL", "TONE", "TOOK", "TOOL", "TOUR", "TOWN", "TREE",
            "TRIP", "TRUE", "TUNE", "TURN", "TWIN", "TYPE", "UNIT", "UPON", "USED", "USER", "VARY", "VAST",
            "VERY", "VICE", "VIEW", "VOTE", "WAGE", "WAIT", "WAKE", "WALK", "WALL", "WANT", "WARD", "WARM",
            "WASH", "WAVE", "WAYS", "WEAK", "WEAR", "WEEK", "WELL", "WENT", "WERE", "WEST", "WHAT", "WHEN",
            "WHOM", "WIDE", "WIFE", "WILD", "WILL", "WIND", "WINE", "WING", "WIPE", "WIRE", "WISE", "WISH",
            "WITH", "WOOD", "WORD", "WORE", "WORK", "YARD", "YEAR", "ZERO", "ZONE",
            # 5 letters
            "ABOUT", "ABOVE", "ABUSE", "ACTOR", "ACUTE", "ADMIT", "ADOPT", "ADULT", "AFTER", "AGAIN", "AGENT",
            "AGREE", "AHEAD", "ALARM", "ALBUM", "ALERT", "ALIKE", "ALIVE", "ALLOW", "ALONE", "ALONG", "ALTER",
            "AMONG", "ANGER", "ANGLE", "ANGRY", "APART", "APPLE", "APPLY", "ARENA", "ARGUE", "ARISE", "ARRAY",
            "ASIDE", "ASSET", "AUDIO", "AUDIT", "AVOID", "AWAIT", "AWAKE", "AWARD", "AWARE", "BADLY", "BAKER",
            "BASES", "BASIC", "BASIS", "BEACH", "BEGAN", "BEGIN", "BEGUN", "BEING", "BELOW", "BENCH", "BILLY",
            "BIRTH", "BLACK", "BLAME", "BLIND", "BLOCK", "BLOOD", "BOARD", "BOOST", "BOOTH", "BOUND", "BRAIN",
            "BRAND", "BREAD", "BREAK", "BREED", "BRIEF", "BRING", "BROAD", "BROKE", "BROWN", "BUILD", "BUILT",
            "BUYER", "CABLE", "CALIF", "CARRY", "CATCH", "CAUSE", "CHAIN", "CHAIR", "CHART", "CHASE", "CHEAP",
            "CHECK", "CHEST", "CHIEF", "CHILD", "CHINA", "CHOSE", "CIVIL", "CLAIM", "CLASS", "CLEAN", "CLEAR",
            "CLICK", "CLOCK", "CLOSE", "COACH", "COAST", "COULD", "COUNT", "COURT", "COVER", "CRAFT", "CRASH",
            "CREAM", "CRIME", "CROSS", "CROWD", "CROWN", "CURLY", "CYCLE", "DAILY", "DANCE", "DATED", "DEALT",
            "DEATH", "DEBUT", "DELAY", "DEPTH", "DOING", "DOUBT", "DOZEN", "DRAFT", "DRAMA", "DRANK", "DRAWN",
            "DREAM", "DRESS", "DRILL", "DRINK", "DRIVE", "DROVE", "DYING", "EAGER", "EARLY", "EARTH", "EIGHT",
            "ELITE", "EMPTY", "ENEMY", "ENJOY", "ENTER", "ENTRY", "EQUAL", "ERROR", "EVENT", "EVERY", "EXACT",
            "EXIST", "EXTRA", "FAITH", "FALSE", "FAULT", "FIBER", "FIELD", "FIFTH", "FIFTY", "FIGHT", "FINAL",
            "FIRST", "FIXED", "FLASH", "FLEET", "FLOOR", "FLUID", "FOCUS", "FORCE", "FORTH", "FORTY", "FORUM",
            "FOUND", "FRAME", "FRANK", "FRAUD", "FRESH", "FRONT", "FRUIT", "FULLY", "FUNNY", "GIANT", "GIVEN",
            "GLASS", "GLOBE", "GOING", "GRACE", "GRADE", "GRAND", "GRANT", "GRASS", "GREAT", "GREEN", "GROSS",
            "GROUP", "GROWN", "GUARD", "GUESS", "GUEST", "GUIDE", "HAPPY", "HARRY", "HEART", "HEAVY", "HENCE",
            "HENRY", "HORSE", "HOTEL", "HOUSE", "HUMAN", "IDEAL", "IMAGE", "INDEX", "INNER", "INPUT", "ISSUE",
            "JAPAN", "JIMMY", "JOINT", "JONES", "JUDGE", "KNOWN", "LABEL", "LARGE", "LASER", "LATER", "LAUGH",
            "LAYER", "LEARN", "LEASE", "LEAST", "LEAVE", "LEGAL", "LEVEL", "LEWIS", "LIGHT", "LIMIT", "LINKS",
            "LIVES", "LOCAL", "LOGIC", "LOOSE", "LOWER", "LUCKY", "LUNCH", "LYING", "MAGIC", "MAJOR", "MAKER",
            "MARCH", "MARRY", "MATCH", "MAYBE", "MAYOR", "MEANT", "MEDIA", "METAL", "MIGHT", "MINOR", "MINUS",
            "MIXED", "MODEL", "MONEY", "MONTH", "MORAL", "MOTOR", "MOUNT", "MOUSE", "MOUTH", "MOVIE", "MUSIC",
            "NEEDS", "NEVER", "NEWLY", "NIGHT", "NOISE", "NORTH", "NOTED", "NOVEL", "NURSE", "OCCUR", "OFFER",
            "OFTEN", "ORDER", "OTHER", "OUGHT", "PAINT", "PANEL", "PAPER", "PARTY", "PEACE", "PETER", "PHASE",
            "PHONE", "PHOTO", "PIECE", "PILOT", "PITCH", "PLACE", "PLAIN", "PLANE", "PLANT", "PLATE", "POINT",
            "POUND", "POWER", "PRESS", "PRICE", "PRIDE", "PRIME", "PRINT", "PRIOR", "PRIZE", "PROOF", "PROUD",
            "PROVE", "QUEEN", "QUICK", "QUIET", "QUITE", "RADIO", "RAISE", "RANGE", "RAPID", "RATIO", "REACH",
            "READY", "REFER", "RIGHT", "RIVAL", "RIVER", "ROBIN", "ROGER", "ROMAN", "ROUGH", "ROUND", "ROUTE",
            "ROYAL", "RURAL", "SCALE", "SCENE", "SCOPE", "SCORE", "SENSE", "SERVE", "SEVEN", "SHALL", "SHAPE",
            "SHARE", "SHARP", "SHEET", "SHELF", "SHELL", "SHIFT", "SHIRT", "SHOCK", "SHOOT", "SHORT", "SHOWN",
            "SIGHT", "SINCE", "SIXTY", "SIZED", "SKILL", "SLEEP", "SLIDE", "SMALL", "SMART", "SMILE", "SMITH",
            "SMOKE", "SOLID", "SOLVE", "SORRY", "SOUND", "SOUTH", "SPACE", "SPARE", "SPEAK", "SPEED", "SPEND",
            "SPENT", "SPLIT", "SPOKE", "SPORT", "STAFF", "STAGE", "STAKE", "STAND", "START", "STATE", "STEAM",
            "STEEL", "STICK", "STILL", "STOCK", "STONE", "STOOD", "STORE", "STORM", "STORY", "STRIP", "STUCK",
            "STUDY", "STUFF", "STYLE", "SUGAR", "SUITE", "SUPER", "SWEET", "TABLE", "TAKEN", "TASTE", "TAXES",
            "TEACH", "TEETH", "TERRY", "TEXAS", "THANK", "THEFT", "THEIR", "THEME", "THERE", "THESE", "THICK",
            "THING", "THINK", "THIRD", "THOSE", "THREE", "THREW", "THROW", "TIGHT", "TIMES", "TIRED", "TITLE",
            "TODAY", "TOPIC", "TOTAL", "TOUCH", "TOUGH", "TOWER", "TRACK", "TRADE", "TRAIN", "TREAT", "TREND",
            "TRIAL", "TRIED", "TRIES", "TRUCK", "TRULY", "TRUST", "TRUTH", "TWICE", "UNDER", "UNDUE", "UNION",
            "UNITY", "UNTIL", "UPPER", "UPSET", "URBAN", "USAGE", "USUAL", "VALID", "VALUE", "VIDEO", "VIRUS",
            "VISIT", "VITAL", "VOICE", "WASTE", "WATCH", "WATER", "WHEEL", "WHERE", "WHICH", "WHILE", "WHITE",
            "WHOLE", "WHOSE", "WOMAN", "WOMEN", "WORLD", "WORRY", "WORSE", "WORST", "WORTH", "WOULD", "WOUND",
            "WRITE", "WRONG", "WROTE", "YIELD", "YOUNG", "YOUTH",
            # 6 to 8 letters common
            "ACCEPT", "ACTIVE", "ACTUAL", "ADVICE", "AFFECT", "AFFORD", "AGREED", "ALWAYS", "AMOUNT", "ANIMAL",
            "ANNUAL", "ANSWER", "ANYONE", "APPEAL", "APPEAR", "AROUND", "ARRIVE", "ARTIST", "ASPECT", "ASSIST",
            "ASSUME", "ATTACK", "ATTEND", "AUGUST", "AUTHOR", "AVENUE", "BACKED", "BARELY", "BATTLE", "BEAUTY",
            "BECAME", "BECOME", "BEFORE", "BEHIND", "BELIEF", "BELONG", "BERLIN", "BETTER", "BEYOND", "BISHOP",
            "BORDER", "BOTTLE", "BOTTOM", "BOUGHT", "BRANCH", "BREATH", "BRIDGE", "BRIGHT", "BROKEN", "BUDGET",
            "BURDEN", "BUREAU", "BUTTON", "CAMERA", "CANCER", "CANNOT", "CARBON", "CAREER", "CASTLE", "CASUAL",
            "CAUGHT", "CENTER", "CENTRE", "CHANCE", "CHANGE", "CHARGE", "CHOICE", "CHOOSE", "CHURCH", "CIRCLE",
            "CLIENT", "CLOSED", "CLOSER", "COFFEE", "COLUMN", "COMBAT", "COMING", "COMMON", "COMPLY", "COPPER",
            "CORNER", "COSTLY", "COUNTY", "COUPLE", "COURSE", "COVERS", "CREATE", "CREDIT", "CRISIS", "CUSTOM",
            "DAMAGE", "DANGER", "DEALER", "DECIDE", "DECREE", "DEFEAT", "DEFECT", "DEFEND", "DEFINE", "DEGREE",
            "DEMAND", "DEPEND", "DEPUTY", "DERIVE", "DESIGN", "DESIRE", "DETAIL", "DETECT", "DEVICE", "DIFFER",
            "DINNER", "DIRECT", "DOCTOR", "DOLLAR", "DOMAIN", "DOUBLE", "DRIVEN", "DRIVER", "DURING", "EASILY",
            "EATING", "EDITOR", "EFFECT", "EFFORT", "EIGHTH", "EITHER", "ELEVEN", "EMERGE", "EMPIRE", "EMPLOY",
            "ENABLE", "ENDING", "ENERGY", "ENGAGE", "ENGINE", "ENOUGH", "ENSURE", "ENTIRE", "ENTITY", "EQUITY",
            "ESCAPE", "ESTATE", "ETHNIC", "EXCEED", "EXCEPT", "EXCUSE", "EXPAND", "EXPECT", "EXPERT", "EXPORT",
            "EXTEND", "EXTENT", "FABRIC", "FACING", "FACTOR", "FAILED", "FAIRLY", "FALLEN", "FAMILY", "FAMOUS",
            "FATHER", "FELLOW", "FEMALE", "FIGURE", "FILING", "FINGER", "FINISH", "FISCAL", "FLIGHT", "FLYING",
            "FOLLOW", "FORCED", "FOREST", "FORGET", "FORMAL", "FORMAT", "FORMER", "FOSTER", "FOUGHT", "FOURTH",
            "FRENCH", "FRIEND", "FUTURE", "GARDEN", "GATHER", "GENDER", "GERMAN", "GLOBAL", "GOLDEN", "GROUND",
            "GROWTH", "GUILTY", "HANDED", "HANDLE", "HAPPEN", "HARDLY", "HEADED", "HEALTH", "HEIGHT", "HIDDEN",
            "HOLDER", "HONEST", "IMPACT", "IMPORT", "INCOME", "INDEED", "INJURY", "INSIDE", "INTEND", "INTENT",
            "INVEST", "ISLAND", "ITSELF", "JERSEY", "JOSEPH", "JUNIOR", "KILLED", "LABOUR", "LATEST", "LATTER",
            "LAUNCH", "LAWYER", "LEADER", "LEAGUE", "LEAVES", "LEGACY", "LENGTH", "LESSON", "LETTER", "LIGHTS",
            "LIKELY", "LINKED", "LIQUID", "LISTEN", "LITTLE", "LIVING", "LOCATE", "LONGER", "LOOKED", "LOSING",
            "LUXURY", "MAINLY", "MAKING", "MANAGE", "MANNER", "MANUAL", "MARGIN", "MARINE", "MARKED", "MARKET",
            "MARTIN", "MASTER", "MATTER", "MATURE", "MEDIUM", "MEMBER", "MEMORY", "MENTAL", "MERELY", "MERGER",
            "METHOD", "MIDDLE", "MILLER", "MINING", "MINUTE", "MIRROR", "MOBILE", "MODERN", "MODIFY", "MODULE",
            "MOMENT", "MORTAL", "MOSTLY", "MOTHER", "MOTION", "MOVING", "MURDER", "MUSEUM", "MUTUAL", "MYSELF",
            "NATION", "NATIVE", "NATURE", "NEARBY", "NEARLY", "NINETY", "NORMAL", "NOTICE", "NOTION", "NUMBER",
            "OBJECT", "OBTAIN", "OFFICE", "OFFSET", "ONLINE", "OPTION", "ORANGE", "ORIGIN", "OUTPUT", "OXFORD",
            "PACKED", "PALACE", "PARENT", "PARTLY", "PATENT", "PEOPLE", "PERIOD", "PERMIT", "PERSON", "PHRASE",
            "PICKED", "PLANET", "PLAYER", "PLEASE", "PLENTY", "POCKET", "POLICE", "POLICY", "POORLY", "POSTED",
            "PRAYER", "PREFER", "PRETTY", "PRINCE", "PRISON", "PROFIT", "PROPER", "PROVEN", "PUBLIC", "PURSUE",
            "RAISED", "RANDOM", "RARELY", "RATHER", "RATING", "READER", "REALLY", "REASON", "RECALL", "RECENT",
            "RECORD", "REDUCE", "REFORM", "REGARD", "REGIME", "REGION", "RELATE", "RELIEF", "REMAIN", "REMOTE",
            "REMOVE", "REPAIR", "REPEAT", "REPLAY", "REPORT", "RESCUE", "RESIGN", "RESIST", "RESORT", "RESULT",
            "RETAIL", "RETAIN", "RETURN", "REVEAL", "REVIEW", "REWARD", "RIDING", "RISING", "ROBUST", "RULING",
            "SAFETY", "SALARY", "SAMPLE", "SAVING", "SCHEME", "SCHOOL", "SCREEN", "SEARCH", "SEASON", "SECOND",
            "SECRET", "SECTOR", "SECURE", "SEEING", "SELDOM", "SELECT", "SELLER", "SENIOR", "SERIES", "SERVER",
            "SETTLE", "SEVERE", "SEXUAL", "SHOULD", "SIGNAL", "SIGNED", "SILENT", "SILVER", "SIMPLE", "SIMPLY",
            "SINGLE", "SISTER", "SLIGHT", "SMOOTH", "SOCIAL", "SOLELY", "SOUGHT", "SOURCE", "SOVIET", "SPEECH",
            "SPIRIT", "SPREAD", "SPRING", "SQUARE", "STABLE", "STATUS", "STEADY", "STOLEN", "STRAIN", "STREAM",
            "STREET", "STRESS", "STRICT", "STRIKE", "STRING", "STRONG", "STRUCK", "STUDIO", "SUBMIT", "SUDDEN",
            "SUFFER", "SUMMER", "SUMMIT", "SUPPLY", "SURELY", "SURVEY", "SWITCH", "SYMBOL", "SYSTEM", "TALENT",
            "TARGET", "TAUGHT", "TENANT", "TENDER", "TENNIS", "THANKS", "THEORY", "THIRTY", "THOUGH", "THREAT",
            "TIMING", "TISSUE", "TOWARD", "TRAVEL", "TREATY", "TRYING", "TWELVE", "TWENTY", "UNABLE", "UNIQUE",
            "UNITED", "UNLESS", "UNLIKE", "UPDATE", "USEFUL", "VALLEY", "VARIED", "VENDOR", "VESSEL", "VICTIM",
            "VISION", "VISUAL", "VOLUME", "WALKER", "WEALTH", "WEEKLY", "WEIGHT", "WHOLLY", "WINDOW", "WINNER",
            "WINTER", "WITHIN", "WONDER", "WORKER", "WRITER", "YELLOW",
            # Multi-word crossword classics
            "CROSSWORD", "LETTERS", "MULTIPLAYER", "CONQUER", "PUZZLE", "SCRABBLE", "VICTORY", "CHAMPION"
        ]
        self._words.update(core_words)

# Global default instance
dictionary_service = DictionaryService()
