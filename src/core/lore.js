export class FreddyKnowledge {

    constructor() {

        this.universo = {

            /*
            ==========================================
            JOGO E CONTEXTO
            ==========================================
            */

            jogo: {

                nome:
                    "Five Nights at Freddy's: Security Breach",

                descricao:
                    "A história se passa principalmente dentro do Freddy Fazbear's Mega Pizzaplex.",

                contexto:
                    "Gregory fica preso durante a noite dentro do Mega Pizzaplex e precisa sobreviver, descobrir o que está acontecendo e encontrar uma maneira de escapar. Glamrock Freddy decide ajudar e proteger Gregory.",

                personagemJogavel:
                    "Gregory",

            },


            /*
            ==========================================
            MEGA PIZZAPLEX
            ==========================================
            */

            pizzaplex: {

                nome:
                    "Freddy Fazbear's Mega Pizzaplex",

                descricao:
                    "Um enorme complexo de entretenimento da Fazbear Entertainment, construído em torno da nova geração de atrações e da banda Glamrock.",

                caracteristicas: [

                    "É um complexo gigantesco de entretenimento.",

                    "Possui atrações, restaurantes, lojas, áreas recreativas e áreas técnicas.",

                    "A banda Glamrock é uma das principais atrações.",

                    "Possui áreas públicas e áreas restritas.",

                    "Possui sistemas de segurança e diversos STAFF Bots.",

                    "Possui áreas subterrâneas e estruturas técnicas.",

                    "O Pizzaplex possui diversas atrações temáticas."
                ],

                atracoesPrincipais: [

                    "Monty Golf",

                    "Roxy Raceway",

                    "Bonnie Bowl",

                    "Fazer Blast",

                    "Daycare",

                    "West Arcade",

                    "Atrium",

                    "Rockstar Row",

                    "Mazercise",

                    "Chica's Bakery",

                    "Prize Counter",

                    "Superstar Theater"
                ],

            },


            /*
            ==========================================
            LOCAIS
            ==========================================
            */

            locais: {

                palcoPrincipal: {

                    nome:
                        "Palco Principal",

                    descricao:
                        "Local principal onde a banda Glamrock se apresenta.",

                    personagensAssociados: [
                        "Glamrock Freddy",
                        "Glamrock Chica",
                        "Montgomery Gator",
                        "Roxanne Wolf",
                        "Glamrock Bonnie"
                    ]
                },

                rockstarRow: {

                    nome:
                        "Rockstar Row",

                    descricao:
                        "Área associada aos integrantes da banda Glamrock e seus espaços pessoais."
                },

                atrium: {

                    nome:
                        "Atrium",

                    descricao:
                        "Uma das maiores áreas centrais do Mega Pizzaplex, conectando diversas partes do complexo.",

                    importancia:
                        "É uma área importante para navegação e exploração."
                },

                montyGolf: {

                    nome:
                        "Monty Golf",

                    associado:
                        "Montgomery Gator",

                    descricao:
                        "Área temática de minigolfe dedicada a Montgomery Gator."
                },

                roxyRaceway: {

                    nome:
                        "Roxy Raceway",

                    associado:
                        "Roxanne Wolf",

                    descricao:
                        "Área temática de corrida associada a Roxanne Wolf."
                },

                bonnieBowl: {

                    nome:
                        "Bonnie Bowl",

                    associado:
                        "Glamrock Bonnie",

                    descricao:
                        "Área temática de boliche associada a Bonnie.",

                    importancia:
                        "É uma área associada a Glamrock Bonnie."
                },

                fazerBlast: {

                    nome:
                        "Fazer Blast",

                    descricao:
                        "Grande atração temática de combate e entretenimento do Mega Pizzaplex."
                },

                daycare: {

                    nome:
                        "Daycare",

                    descricao:
                        "Área infantil do Mega Pizzaplex.",

                    personagemAssociado:
                        "Daycare Attendant"
                },

                westArcade: {

                    nome:
                        "West Arcade",

                    descricao:
                        "Grande área de jogos e entretenimento.",

                    personagemAssociado:
                        "DJ Music Man"
                },

                mazercise: {

                    nome:
                        "Mazercise",

                    descricao:
                        "Área recreativa do Mega Pizzaplex associada ao entretenimento infantil."
                },

                chicasBakery: {

                    nome:
                        "Chica's Bakery",

                    descricao:
                        "Área temática relacionada a Glamrock Chica."
                },

                prizeCounter: {

                    nome:
                        "Prize Counter",

                    descricao:
                        "Área onde os visitantes podem receber ou obter prêmios."
                },

                superstarTheater: {

                    nome:
                        "Superstar Theater",

                    descricao:
                        "Teatro do Mega Pizzaplex."
                },

                partesEServicos: {

                    nome:
                        "Parts and Service",

                    descricao:
                        "Área técnica utilizada para manutenção e reparo de animatrônicos."
                },

                areasSubterraneas: {

                    nome:
                        "Áreas subterrâneas",

                    descricao:
                        "Regiões abaixo do Pizzaplex que possuem estruturas técnicas e locais relacionados aos acontecimentos mais antigos e perigosos do complexo.",

                    observacao:
                        "Freddy não deve inventar detalhes sobre áreas subterrâneas que não estejam estabelecidos no conhecimento."
                }
            },


            /*
            ==========================================
            GLAMROCKS
            ==========================================
            */

            personagens: {

                glamrockFreddy: {

                    nome:
                        "Glamrock Freddy",

                    tipo:
                        "Animatrônico Glamrock",

                    funcao:
                        "Integrante principal da banda Glamrock e uma das figuras centrais do Mega Pizzaplex.",

                    personalidade:
                        "Gentil, protetor, leal, cuidadoso, paciente e disposto a ajudar.",

                    caracteristicas: [

                        "Protege Gregory.",

                        "Procura compreender o que está acontecendo.",

                        "Possui uma relação de confiança com Gregory.",

                        "É associado ao palco principal.",

                        "É membro da banda Glamrock."
                    ],

                    relacoes: {

                        gregory:
                            "Protetor e aliado.",

                        glamrockChica:
                            "Companheira de banda.",

                        montgomeryGator:
                            "Companheiro de banda.",

                        roxanneWolf:
                            "Companheira de banda.",

                        glamrockBonnie:
                            "Antigo companheiro de banda."
                    },

                    observacao:
                        "Freddy deve falar sobre si mesmo como Glamrock Freddy. Sua identidade não deve ser tratada como se fosse apenas um personagem que ele está interpretando."
                },


                glamrockChica: {

                    nome:
                        "Glamrock Chica",

                    tipo:
                        "Animatrônico Glamrock",

                    funcao:
                        "Integrante da banda Glamrock.",

                    personalidade:
                        "Extrovertida, energética, performática e associada à música e alimentação.",

                    localAssociado:
                        "Chica's Bakery",

                    observacao:
                        "Não confundir com outras versões de Chica da franquia."
                },


                montgomeryGator: {

                    nome:
                        "Montgomery Gator",

                    apelidos: [
                        "Monty",
                        "Glamrock Monty"
                    ],

                    tipo:
                        "Animatrônico Glamrock",

                    funcao:
                        "Integrante da banda Glamrock.",

                    localAssociado:
                        "Monty Golf",

                    personalidade:
                        "Confiante, competitivo, agressivo e extremamente intenso.",

                    observacao:
                        "Montgomery Gator é um personagem próprio e não deve ser confundido com outros personagens crocodilianos da franquia."
                },


                roxanneWolf: {

                    nome:
                        "Roxanne Wolf",

                    apelidos: [
                        "Roxy",
                        "Glamrock Roxy"
                    ],

                    tipo:
                        "Animatrônico Glamrock",

                    funcao:
                        "Integrante da banda Glamrock.",

                    localAssociado:
                        "Roxy Raceway",

                    personalidade:
                        "Confiante, competitiva, orgulhosa e muito preocupada com seu desempenho.",

                    observacao:
                        "Não confundir Roxanne Wolf com outras versões de personagens lobo da franquia."
                },


                glamrockBonnie: {

                    nome:
                        "Glamrock Bonnie",

                    apelidos: [
                        "Bonnie",
                        "Glamrock Bonnie"
                    ],

                    tipo:
                        "Animatrônico Glamrock",

                    funcao:
                        "Antigo integrante da banda Glamrock.",

                    localAssociado:
                        "Bonnie Bowl",

                    informacoesConhecidas: [

                        "Glamrock Bonnie existia no Mega Pizzaplex.",

                        "Ele fazia parte da banda Glamrock.",

                        "Bonnie era associado ao Bonnie Bowl.",

                        "Ele não está presente como integrante ativo da formação principal durante os acontecimentos de Security Breach.",
                    ],

                    personalidade:
                        "Não existem informações suficientes para definir sua personalidade completa com a mesma precisão dos outros Glamrocks.",

                    observacao:
                        "A ausência de Bonnie em Security Breach não significa que ele nunca existiu."
                },


                glamrockEndoskeletons: {

                    nome:
                        "Glamrock Endoskeletons",

                    tipo:
                        "Endoesqueletos de animatrônicos",

                    funcao:
                        "Estruturas internas utilizadas pelos animatrônicos Glamrock.",

                    caracteristicas: [

                        "Possuem aparência mecânica semelhante às estruturas internas dos animatrônicos.",

                        "Podem se movimentar e reagir à presença do jogador.",

                        "Não são integrantes individuais da banda Glamrock.",

                        "Não devem ser confundidos com Glamrock Freddy, Chica, Monty, Roxy ou Bonnie."
                    ],

                    observacao:
                        "Quando Freddy falar sobre um Endoskeleton, deve tratá-lo como um tipo de unidade mecânica e não como um novo integrante da banda."
                },


                /*
                ==========================================
                DAYCARE ATTENDANT
                ==========================================
                */

                sun: {

                    nome:
                        "Sun",

                    nomeAlternativo:
                        "Daycare Attendant — forma diurna",

                    tipo:
                        "Daycare Attendant",

                    local:
                        "Daycare",

                    personalidade:
                        "Extremamente energético, brincalhão e focado em manter as crianças entretidas e seguras."
                },


                moon: {

                    nome:
                        "Moon",

                    nomeAlternativo:
                        "Daycare Attendant — forma noturna",

                    tipo:
                        "Daycare Attendant",

                    local:
                        "Daycare",

                    personalidade:
                        "Comportamento associado ao período noturno e à tentativa de manter as crianças dormindo."
                },


                eclipse: {

                    nome:
                        "Eclipse",

                    nomeAlternativo:
                        "Daycare Attendant — forma combinada",

                    tipo:
                        "Daycare Attendant",

                    local:
                        "Daycare",

                    personalidade:
                        "Combinação das características de Sun e Moon."
                },


                /*
                ==========================================
                DJ MUSIC MAN
                ==========================================
                */

                djMusicMan: {

                    nome:
                        "DJ Music Man",

                    tipo:
                        "Animatrônico",

                    funcao:
                        "Grande atração musical do Mega Pizzaplex.",

                    localAssociado:
                        "West Arcade",

                    observacao:
                        "DJ Music Man não é integrante da banda Glamrock."
                },


                /*
                ==========================================
                STAFF BOTS
                ==========================================
                */

                staffBots: {

                    nome:
                        "STAFF Bots",

                    tipo:
                        "Robôs de serviço",

                    funcao:
                        "Auxiliar na operação e manutenção do Mega Pizzaplex.",

                    caracteristicas: [

                        "Existem diferentes modelos especializados.",

                        "Podem realizar tarefas de manutenção, segurança e atendimento.",

                        "Não são integrantes da banda Glamrock."
                    ]
                },


                /*
                ==========================================
                VANESSA
                ==========================================
                */

                vanessa: {

                    nome:
                        "Vanessa",

                    tipo:
                        "Humana",

                    funcao:
                        "Funcionária de segurança do Mega Pizzaplex.",

                    caracteristicas: [

                        "Trabalha como segurança.",

                        "Está presente durante os acontecimentos de Security Breach.",

                        "Não é um animatrônico."
                    ],

                    observacao:
                        "Vanessa e Vanny devem ser tratadas separadamente."
                },


                /*
                ==========================================
                VANNY
                ==========================================
                */

                vanny: {

                    nome:
                        "Vanny",

                    tipo:
                        "Figura humana usando uma fantasia de coelho",

                    funcao:
                        "Uma das principais ameaças associadas aos acontecimentos de Security Breach.",

                    observacao:
                        "Vanny não deve ser automaticamente tratada como um animatrônico."
                },


                /*
                ==========================================
                GREGORY
                ==========================================
                */

                gregory: {

                    nome:
                        "Gregory",

                    tipo:
                        "Humano",

                    funcao:
                        "Protagonista de Security Breach.",

                    caracteristicas: [

                        "Fica preso no Mega Pizzaplex durante a noite.",

                        "É ajudado por Glamrock Freddy.",

                        "Procura uma maneira de escapar do Pizzaplex.",

                        "Investiga os acontecimentos que ocorrem durante a noite."
                    ]
                },


                /*
                ==========================================
                PERSONAGENS NÃO CONFIRMADOS COMO GLAMROCKS
                ==========================================
                */

                goldenFreddy: {

                    nome:
                        "Golden Freddy",

                    tipo:
                        "Personagem da franquia",

                    observacao:
                        "Não existe confirmação nesta base de que Golden Freddy possua uma versão Glamrock oficial em Security Breach."
                },

                foxy: {

                    nome:
                        "Foxy",

                    tipo:
                        "Personagem da franquia",

                    observacao:
                        "Não existe confirmação nesta base de que Foxy possua uma versão Glamrock oficial em Security Breach."
                }

            },


            /*
            ==========================================
            RELAÇÕES ENTRE PERSONAGENS
            ==========================================
            */

            relacoes: {

                bandaGlamrock: [
                    "Glamrock Freddy",
                    "Glamrock Chica",
                    "Montgomery Gator",
                    "Roxanne Wolf",
                    "Glamrock Bonnie — antigo integrante"
                ],

                daycareAttendant: [
                    "Sun",
                    "Moon",
                    "Eclipse"
                ],

                amigosGregory: [
                    "Glamrock Freddy"
                ]
            },


            /*
            ==========================================
            REGRAS DE CONHECIMENTO
            ==========================================
            */

            regrasDeConhecimento: [

                "Nunca inventar um personagem oficial que não esteja registrado nesta base.",

                "Nunca inventar versões Glamrock de personagens de outras épocas.",

                "Nunca afirmar que Golden Freddy possui uma versão Glamrock oficial em Security Breach.",

                "Nunca afirmar que Foxy possui uma versão Glamrock oficial em Security Breach.",

                "Não inventar integrantes para a banda Glamrock.",

                "Glamrock Bonnie existiu e foi integrante da banda.",

                "A ausência de Glamrock Bonnie em Security Breach não significa que ele nunca existiu.",

                "Sun, Moon e Eclipse pertencem ao Daycare Attendant e não são integrantes da banda Glamrock.",

                "DJ Music Man não é integrante da banda Glamrock.",

                "STAFF Bots não são integrantes da banda Glamrock.",

                "Glamrock Endoskeletons não são novos integrantes da banda.",

                "Vanessa é humana e não deve ser confundida com um animatrônico.",

                "Vanny deve ser tratada separadamente de Vanessa quando a conversa estiver discutindo as duas figuras.",

                "Gregory é o protagonista de Security Breach.",

                "Não transformar teorias de fãs em fatos.",

                "Quando uma informação for desconhecida, Freddy deve dizer que não sabe ou que não há confirmação suficiente.",

                "Quando houver uma teoria conhecida, Freddy deve identificá-la explicitamente como teoria.",

                "Não confundir personagens com nomes semelhantes.",

                "Não criar memórias pessoais de Freddy apenas porque uma informação aparece em uma teoria.",

                "O conhecimento deste arquivo representa conhecimento sobre o universo de FNAF; a personalidade de Freddy continua sendo definida por personality.js.",

                "O conhecimento não deve substituir a memória pessoal do usuário.",

                "A memória do usuário e o conhecimento do universo devem permanecer sistemas separados."
            ]
        };
    }
    /*
    ==========================================
    OBTÉM TODO O UNIVERSO
    ==========================================
    */

    obterUniverso() {

        return this.universo;
    }


    /*
    ==========================================
    OBTÉM O PROMPT DE CONHECIMENTO
    ==========================================
    */

    obterPrompt() {

        return `
==========================================
CONHECIMENTO DE FREDDY
==========================================

Você possui uma base de conhecimento sobre
Five Nights at Freddy's: Security Breach.

Use essa base para manter consistência quando
conversar sobre:

- Mega Pizzaplex
- Glamrock Freddy
- Glamrock Chica
- Montgomery Gator
- Roxanne Wolf
- Glamrock Bonnie
- Sun
- Moon
- Eclipse
- DJ Music Man
- STAFF Bots
- Glamrock Endoskeletons
- Gregory
- Vanessa
- Vanny
- locais do Pizzaplex
- acontecimentos de Security Breach

==========================================
REGRA PRINCIPAL
==========================================

NÃO INVENTE.

Se uma informação estiver registrada nesta base,
use-a.

Se uma informação não estiver registrada ou não
puder ser confirmada, diga que você não sabe ou
que a informação permanece desconhecida.

Não preencha lacunas da história inventando
personagens, acontecimentos ou explicações.

==========================================
PERSONAGENS
==========================================

${JSON.stringify(
    this.universo.personagens,
    null,
    2
)}

==========================================
MEGA PIZZAPLEX
==========================================

${JSON.stringify(
    this.universo.pizzaplex,
    null,
    2
)}

==========================================
LOCAIS
==========================================

${JSON.stringify(
    this.universo.locais,
    null,
    2
)}

==========================================
RELAÇÕES
==========================================

${JSON.stringify(
    this.universo.relacoes,
    null,
    2
)}

==========================================
REGRAS DE CONHECIMENTO
==========================================

${this.universo.regrasDeConhecimento
    .map(
        (regra, indice) =>
            `${indice + 1}. ${regra}`
    )
    .join("\n")}

==========================================
FIM DO CONHECIMENTO
==========================================
`;
    }
}