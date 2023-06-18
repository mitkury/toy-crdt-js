const emojis = [
    "🌈", // rainbow
    "🌸", // cherry blossom
    "🌼", // sunflower
    "🍭", // lollipop
    "🌀", // swirl
    "🌺", // hibiscus
    "🌻", // sunflower
    "🌹", // rose
    "🌷", // tulip
    "🌴", // palm tree
    "🌵", // cactus
    "🌾", // sheaf of rice
    "🌿", // herb
    "🍀", // four leaf clover
    "🍁", // maple leaf
    "🍂", // fallen leaf
    "🍃", // leaf fluttering in wind
    "🍄", // mushroom
    "🍅", // tomato
    "🍆", // eggplant
    "🍇", // grapes
    "🍈", // melon
    "🍉", // watermelon
    "🍊", // tangerine
    "🍋", // lemon
    "🍌", // banana
    "🍍", // pineapple
    "🍎", // red apple
    "🍏", // green apple
    "🍑", // peach
    "🍒", // cherries
    "🍓", // strawberry
    "🥑", // avocado
    "🥒", // cucumber
    "🥕", // carrot
    "🌽", // ear of corn
    "🌶️", // hot pepper
    "🥔", // potato
    "🥜", // peanuts
    "🥐", // croissant
    "🍞", // bread
    "🥖", // baguette bread
    "🥨", // pretzel
    "🥯", // bagel
    "🥞", // pancakes
    "🧀", // cheese
    "🍖", // meat on bone
    "🍗", // poultry leg
    "🥩", // steak
    "🥓", // bacon
    "🍔", // hamburger
    "🍟", // french fries
    "🍕", // pizza
    "🌮", // taco
    "🌯", // burrito
    "🥙", // falafel
    "🍲", // pot of food
    "🥘", // shallow pan of food
    "🍛", // curry and rice
    "🍜", // steaming bowl
    "🍝", // spaghetti
    "🍠", // roasted sweet potato
    "🍢", // oden
    "🍣", // sushi
    "🍤", // fried shrimp
    "🍥", // fish cake with swirl
    "🥮", // mooncake
    "🍦", // soft ice cream
    "🍧", // shaved ice
    "🍨", // ice cream
    "🍩", // doughnut
    "🍪", // cookie
    "🎂", // birthday cake
    "🍰", // shortcake
    "🧁", // cupcake
    "🥧", // pie
    "🍮", // custard
    "🍭", // lollipop
    "🍬", // candy
    "🍫", // chocolate bar
    "🍿", // popcorn
    "🥤", // glass of milk
    "🍺", // beer mug
    "🍻", // clinking beer mugs
    "🥂", // clinking glasses
    "🍷", // wine glass
    "🥃", // tumbler glass
    "🍸", // cocktail glass
    "🍹", // tropical drink
    "🍾", // bottle with popping cork
    "🥄", // spoon
    "🍴", // fork and knife
    "🍽️", // fork and knife with plate
    "🥢", // chopsticks
    "🍽", // fork and knife with plate
    "🥄", // spoon
    "🏺", // amphora
    "🌍", // globe showing Europe-Africa
    "🌎", // globe showing Americas
    "🌏", // globe showing Asia-Australia
    "🌐", // globe with meridians
    "🗺️", // world map
    "🗾", // map of Japan
    "🧭", // compass
    "🏔️", // snow-capped mountain
    "⛰️", // mountain
    "🌋", // volcano
    "🗻", // mount fuji
    "🏕️", // camping
    "🏖️", // beach with umbrella
    "🏜️", // desert
    "🏝️", // desert island
    "🏞️", // national park
    "🏟️", // stadium
    "🏛️", // classical building
    "🏗️", // building construction
    "🏘️", // houses
    "🏙️", // cityscape
    "🏚️", // derelict house
    "🏠", // house
    "🏡", // house with garden
    "🏢", // office building
    "🏣", // Japanese post office
    "🏤", // post office
    "🏥", // hospital
    "🏦", // bank
    "🏨", // hotel
    "🏩", // love hotel
    "🏪", // convenience store
    "🏫", // school
    "🏬", // department store
    "🏭", // factory
    "🏯", // Japanese castle
    "🏰", // castle
    "💒", // wedding
    "🗼", // Tokyo tower
    "🗽", // Statue of Liberty
    "⛪️", // church
    "🕌", // mosque
    "🛕", // hindu temple
    "🕍", // synagogue
    "⛩️", // shrine
    "🕋", // kaaba
    "⛲️", // fountain
    "😂", // Face with Tears of Joy
    "🤣", // Rolling on the Floor Laughing
    "😹", // Cat Face with Tears of Joy
    "😻", // Smiling Cat Face with Heart-Eyes
    "🤪", // Zany Face  
]

export const getRandomEmoji = () => {
    return emojis[Math.floor(Math.random() * emojis.length)]
}