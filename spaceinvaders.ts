import { interval, fromEvent, merge} from "rxjs";
import { map, filter, scan} from 'rxjs/operators'

function spaceinvaders() {
    // Attribute Setter
    const attr = (e:Element,o:Object) =>
    { for(const k in o) e.setAttribute(k,String(o[k])) }

    // Boolean Operator (Not)
    const not = <T>(f:(x:T)=>boolean)=> (x:T)=> !f(x)

    
    // Constants
    const 
      Constants = {
        CanvasSize: 600,
        BulletExpirationTime: 265,
        BulletRadius: 5,
        BulletVelocity: 2,
        StartShieldRadius: 5,
        StartShieldsPos: [90, 230, 370, 510],
        StartEnemyRadius: 8,
        StartEnemySpeed: 0.12,
        StartEnemyPos: [120, 160, 200, 240, 280, 320, 360, 400, 440, 480],
        StartEnemyCount: 50,
        RotationAcc: 0.1,
        ThrustAcc: 0.1,
        StartTime: 0  
      } as const

    // Shield Co-ordinate Generator (generates positions for a shield block which is made of many small shields)
    const 
      geaves = (x: number) => 
      [[x, 450], [x-10, 450], [x+10, 450], [x-20, 450], [x+20, 450], 
      [x, 460], [x-10, 460], [x+10, 460], [x-20, 460], [x+20, 460], [x+30, 460], [x-30, 460],
      [x, 470] ,[x-10, 470], [x+10, 470], [x-20, 470], [x+20, 470], [x+30, 470], [x-30, 470], 
      [x-20, 480], [x+20, 480], [x+30, 480], [x-30, 480],
      [x-20, 490], [x+20, 490], [x+30, 490], [x-30, 490]],
      shieldGen = Constants.StartShieldsPos.map(geaves).flat()
    
    // Enemy Co-ordinate Generator
    const 
      geaves2 = (x: number) => 
      [[x, 100], [x, 135], [x, 170], [x, 205], [x, 240]],
      enemyGen = Constants.StartEnemyPos.map(geaves2).flat()

    // Key Events & Types
    type Event = 'keydown' | 'keyup'
    type Key = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'Space'
    type ViewType = 'ship' | 'shield' | 'bullet' | 'enemies' | 'enemybullet'
    
    // Game Transitions
    class Tick { constructor(public readonly elapsed: number) {} }
    class LeftThrust { constructor(public readonly on: boolean) {} }
    class RightThrust { constructor(public readonly on: boolean) {} }
    class Shoot { constructor() {} }
    class EnemyShoot { constructor() {} }
    class MouseMove{ constructor (public readonly xval: number, public readonly yval: number) {} }

    // Type Declarations
    type Body = Readonly<{
      id: string,
      viewType: ViewType
      pos: Vec,
      vel: Vec,
      thrust: boolean,
      acc: Vec,
      angle: number,
      rotation: number,
      torque: number,
      radius: number,
      createTime: number,
      initalPos: Vec,
      bottom: boolean
    }>
    
    type State = Readonly<{
      time:number,
      ship:Body,
      bullets:ReadonlyArray<Body>,
      exit:ReadonlyArray<Body>,
      shields:ReadonlyArray<Body>,
      gameOver:boolean,
      enemies: ReadonlyArray<Body>,
      objCount:number
      deadEnemies: ReadonlyArray<Number>,
      dangerousEnemies: ReadonlyArray<Body>,
      randNum: number,
      lives: number,
      points: number,
      textEle: ReadonlyArray<Texts>,
      exitText: ReadonlyArray<Texts>,
      level: number,
      prevscore:number
    }>

    type Texts = Readonly<{
      id: string,
      content: string,
      xpos: number,
      ypos: number,
      style: string
    }>

    // View Updater
    function updateView(s:State): void {
      const 
        ship = document.getElementById("ship")!,
        svg = document.getElementById("svgCanvas")!,
        show = (id:string,condition:boolean)=>((e:HTMLElement) => 
          condition ? e.classList.remove('hidden')
                  : e.classList.add('hidden'))(document.getElementById(id)!),
      
        updateBodyView = (b:Body) => {
          function createBodyView() {
            const v = document.createElementNS(svg.namespaceURI, "ellipse")!;
            attr(v,{id:b.id,rx:b.radius,ry:b.radius});
            v.classList.add(b.viewType)
            svg.appendChild(v)
            return v;
          }
          const v = document.getElementById(b.id) || createBodyView();
          attr(v,{cx:b.pos.x,cy:b.pos.y});
        },

        updateTextView = (s: Texts) => {
            const v = document.createElementNS(svg.namespaceURI, "text")!;
            attr(v,{id:s.id, x: s.xpos, y: s.ypos, class: s.style});
            v.textContent = s.content
            svg.appendChild(v)
            return v;
        };

                  
      show("leftThrust", s.ship.acc.x<0)
      show("rightThrust", s.ship.acc.x>0)

      attr(ship,{transform:`translate(${s.ship.pos.x},${s.ship.pos.y}) rotate(${s.ship.angle})`});


      s.exitText.forEach(o=>{
        const v = document.getElementById(o.id);
        if(v) svg.removeChild(v)
      })

      s.exit.forEach(o=>{
        const v = document.getElementById(o.id);
        if(v) svg.removeChild(v)
      })


      s.bullets.forEach(updateBodyView);
      s.shields.forEach(updateBodyView);
      s.enemies.forEach(updateBodyView);
      s.textEle.forEach(updateTextView);


      // Displays End Screen 
      function endScreen () {
        const v = document.createElementNS(svg.namespaceURI, "rect")!;

        attr(v,{id:'gameoverBox',x:150, y:100, height:70, width:300, class: 'restartbox'});
        svg.appendChild(v);

        const b = document.createElementNS(svg.namespaceURI, "rect")!;
        attr(b,{id:'restartBox',x:200, y:220, height:70, width:200, class: 'restartbox'});
        svg.appendChild(b);

        [<Texts>{id: 'restartText', content: "Restart?", xpos:217, ypos:267, style: "restart"}].forEach(updateTextView)
      }
      
      // Check if mouse if over restart button
      function restarthover(b: boolean) {
        if(b){
          svg.removeChild(document.getElementById('restartText'));
          updateTextView(<Texts>{id: 'restartText', content: "Restart?", xpos:217, ypos:267, style: "restarthover"}) 
        }
        else{
          svg.removeChild(document.getElementById('restartText'));
          updateTextView(<Texts>{id: 'restartText', content: "Restart?", xpos:217, ypos:267, style: "restart"}) 
        }
      }

      // Restart Game sequence (detect clicking on restart button/running restart process)
      function restartGame () {
        // Check if mouse is over restart button
        const isOverRestart = (a: MouseEvent) => {
          const v = document.getElementById("restartBox")
            if(v) {
            const svg = v.getBoundingClientRect()
              return a.clientX > (svg.left) && a.clientX < (svg.right) && a.clientY > (svg.top)  && a.clientY < (svg.bottom) ? true : false
            }
            else{
              return false
            }
          }
         
        // Main Restart Process (unsubscribing from streams, removing bullets/text, resetting main game stream)
        function restart() {
          endscreenMouseMov.unsubscribe(),
          clickRestart.unsubscribe(),

          s.bullets.concat(s.exit).forEach(o=>{
            const v = document.getElementById(o.id);
            if(v) svg.removeChild(v)
          }),
        
          ['gameoverText', 'gameoverBox', 'restartText', 'restartBox'].map(a=>document.getElementById(a)).forEach(a=>svg.removeChild(a))

          subscription = sub(1, 1, 0)
        }

        // Stream to detect mouse movement
        const endscreenMouseMov = fromEvent(document, 'mousemove')
        .pipe(map((a:MouseEvent)=> isOverRestart(a)))
        .subscribe(restarthover);
        


        // Stream to detect mouse click
        const clickRestart = fromEvent(document, 'mousedown')
        .pipe(filter((a:MouseEvent)=> isOverRestart(a)))
        .subscribe(restart, console.log);
      }
      

      // Check if there are any remaining enemies (progress to next level)
      if(s.enemies.length < 1) {
        subscription.unsubscribe();
        s.bullets.concat(s.exit).forEach(o=>{
          const v = document.getElementById(o.id);
          if(v) svg.removeChild(v)
        })
        // Check if player on last level
        if (s.level == 4) {
          endScreen()
          updateTextView(<Texts>{id: 'gameoverText', content: "You Win!", xpos:205, ypos:147, style: "gameover"})

          restartGame()
        }
        // if there are futher levels
        else {
          subscription = sub(s.level+1, s.lives, s.points+20*s.level)
        }
      }

      // Check if player dies (ends game)
      if(s.gameOver) {
        subscription.unsubscribe();

        endScreen()
        updateTextView(<Texts>{id: 'gameoverText', content: "Game Over", xpos:177, ypos:147, style: "gameover"})

        restartGame()
      }
    }
    


    // Vector Physics
    class Vec {
      constructor(public readonly x: number = 0, public readonly y: number = 0) {}
      add = (b:Vec) => new Vec(this.x + b.x, this.y + b.y)
      sub = (b:Vec) => this.add(b.scale(-1))
      scale = (s:number) => new Vec(this.x*s,this.y*s)
      len = ()=> Math.sqrt(this.x*this.x + this.y*this.y)
      ortho = ()=> new Vec(this.y,-this.x)
      rotate = (deg:number) =>
                (rad =>(
                    (cos,sin,{x,y})=>new Vec(x*cos - y*sin, x*sin + y*cos)
                  )(Math.cos(rad), Math.sin(rad), this)
                )(Math.PI * deg / 180)
    
      static unitVecInDirection = (deg: number) => new Vec(0,-1).rotate(deg)
      static Zero = new Vec();
    }

    const 
      torusWrap = ({x,y}:Vec) => { 
        const wrap = (v:number) => 
          v < 0 ? v + Constants.CanvasSize : v > Constants.CanvasSize ? v - Constants.CanvasSize : v;
        return new Vec(wrap(x),wrap(y))
    };
    
    // Circle Body Factory
    const createCircle = (viewType: ViewType)=> (oid:number)=> (time:number)=> (radius:number)=> (pos:Vec)=> (vel:Vec)=>
    <Body>{
      createTime: time,
      pos:pos,
      vel:vel,
      acc:Vec.Zero,
      angle:0, rotation:0, torque:0,
      radius: radius,
      id: viewType+oid,
      viewType: viewType,
      initalPos: pos,
      bottom: false
    };

    // Ship Body Factory
    function createShip():Body {
      return {
        id: "ship",
        viewType: 'ship',
        pos: new Vec(300, 550),
        initalPos: new Vec(300, 550),
        vel: Vec.Zero,
        acc: Vec.Zero,
        rotation: 0,
        thrust: false,
        angle:0,
        torque:0,
        radius:20,
        createTime:0,
        bottom: false
      }
    }

    // Initialise Game
    const
    startShields = shieldGen
      .map((a,i)=>createCircle("shield")
        (i)
        (Constants.StartTime)
        (Constants.StartShieldRadius)
        (new Vec(a[0],a[1]))
        (Vec.Zero)),

    startEnemies = (s: number) => enemyGen
    .map((a,i) => createCircle('enemies')
    (i)
    (Constants.StartTime)
    (Constants.StartEnemyRadius)
    (new Vec(a[0],a[1]))
    (new Vec(Constants.StartEnemySpeed*s, 0)));


  const initialState:State = {
      time:0,
      ship: createShip(),
      bullets: [],
      shields: startShields,
      exit: [],
      objCount: (Constants.StartShieldsPos).length,
      enemies: [],
      gameOver: false,
      deadEnemies: [],
      dangerousEnemies: [],
      randNum: 0,
      lives: 1,
      points: 0,
      textEle: [],
      exitText: [],
      level: 1,
      prevscore: 0
    }

    // State Reducer
    const reduceState = (s:State, e:LeftThrust|RightThrust|Tick)=>
      e instanceof LeftThrust ? {...s,
        ship: {...s.ship, vel:e.on ? new Vec(-2,0)
                : Vec.Zero}
      } :
      e instanceof RightThrust ? {...s,
        ship: {...s.ship, vel:e.on ? new Vec(2,0)
          : Vec.Zero}
      } : 
      e instanceof MouseMove ? {...s,
        ship: {...s.ship, pos: new Vec(e.xval, 550)}
      } : 
      e instanceof Shoot ? {...s,
        bullets: s.bullets.concat([createCircle
          ('bullet')
          (s.objCount)
          (s.time)
          (3)
          (s.ship.pos.add(Vec.unitVecInDirection(s.ship.angle).scale(25)))
          (s.ship.vel.add(Vec.unitVecInDirection(s.ship.angle).scale(2)))]),
        objCount: s.objCount + 1
      } : 
      e instanceof EnemyShoot ? {...s,
        bullets: s.bullets.concat([createCircle
          ('enemybullet')
          (s.objCount)
          (s.time)
          (3)
          (s.dangerousEnemies[s.randNum].pos.add(Vec.unitVecInDirection(s.dangerousEnemies[s.randNum].angle).scale(-20)))
          (s.dangerousEnemies[s.randNum].vel.add(Vec.unitVecInDirection(s.dangerousEnemies[s.randNum].angle).scale(-2)))]),
        objCount: s.objCount + 1
      } :
      tick(s, e.elapsed)

    // Gametick (Move bodies/Enemies shoot/Bullets expire/Text is set)
    const tick = (s:State,elapsed:number) => {
      const not = <T>(f:(x:T)=>boolean)=>(x:T)=>!f(x),
        expired = (b:Body)=>(elapsed - b.createTime) > Constants.BulletExpirationTime,
        expiredBullets:Body[] = s.bullets.filter(expired),
        activeBullets = s.bullets.filter(not(expired));

        // array of enemy id's which are below some given enemy id
        const numbsNeed = (a: number) => 
        [...Array(Math.ceil((a+1)/5)*5-(a+1)).keys()].map(b=>b+a+1)
        
        // returns all enemies which can shoot (have no enemies below them)
        const canShoot = s.enemies.filter(a => numbsNeed(parseInt(a.id.slice(7))).every(elem => s.deadEnemies.includes(elem)))
      
        return handleCollisions({...s, 
        ship:moveObj(s.ship), 
        bullets:activeBullets.map(moveBull), 
        enemies:s.enemies.map(moveEnemy),
        exit:expiredBullets,
        time: elapsed,
        dangerousEnemies: canShoot,
        randNum: Math.round(Math.random()*(canShoot.length-1)),
        points: s.prevscore+(Constants.StartEnemyCount-s.enemies.length)*20*s.level,
        gameOver: s.lives<1,
        exitText: s.textEle
      })
    }

    // Stream Factory
    const
      gameClock = interval(5)
        .pipe(map(elapsed => new Tick(elapsed))),

      observeKey = <T>(e:string, k:Key, result:()=>T)=>
        fromEvent<KeyboardEvent>(document,e)
          .pipe(
            filter(({code})=>code === k),
            filter(({repeat})=>!repeat),
            map(result)),
            
      startLeftThrust = observeKey('keydown','ArrowLeft', ()=>new LeftThrust(true)),
      stopLeftThrust = observeKey('keyup','ArrowLeft', ()=>new LeftThrust(false)),
      startRightThrust = observeKey('keydown','ArrowRight', ()=>new RightThrust(true)),
      stopRightThrust = observeKey('keyup','ArrowRight', ()=>new RightThrust(false)),
      shoot = observeKey('keydown','Space', ()=>new Shoot()),
      
      // Enemy Shoot Stream
      enemyClock = interval(40)
      .pipe(filter(a=> Math.random()>0.95),
            map(() => new EnemyShoot())),
            
      // if Mouse Over svgCanvas      
      isOverCanvas = (a: MouseEvent) => {
      const svg = document.getElementById("svgCanvas").getBoundingClientRect()
        return a.clientX > (svg.left) && a.clientX < (svg.right-10) && a.clientY > (svg.top+10)  && a.clientY < (svg.bottom-10) ? true : false
      }
      
      // Client Mouse Movement Stream
      const mouseMov = fromEvent(document, 'mousemove')
      .pipe(filter((a: MouseEvent) => isOverCanvas(a)),
            map((a: MouseEvent) => new MouseMove(a.clientX, a.clientY)))

    // Stream Processor
    const sub = (s:number, l:number, p:number) =>
      merge(gameClock, enemyClock,
          startLeftThrust,stopLeftThrust,
          startRightThrust,stopRightThrust,
          shoot, mouseMov)
      .pipe(
          scan(reduceState, <State>{...initialState, level: s, enemies:startEnemies(s), lives: l, prevscore: p}))
      .subscribe(updateView);

    // Object Movement
    const moveObj = (o:Body) => <Body>{
      ...o,
      rotation: o.rotation + o.torque,
      angle:o.angle+o.rotation,
      pos: torusWrap(o.pos.add(o.vel)),
      vel: o.vel.add(o.acc)
    }

    // Bullet Movement
    const moveBull = (o:Body) => <Body>{
      ...o,
      rotation: o.rotation + o.torque,
      angle:o.angle+o.rotation,
      pos: o.pos.add(o.vel),
      vel: o.vel.add(o.acc)
    }

    // Flip enemy's direction of movement reaches the side
    const velWrap = (o:Body) => 
        (Math.abs(o.pos.x - o.initalPos.x)) > 80? new Vec(-o.vel.x, 0) : o.vel
    
    // Move enemy down & in opposite direction when it reaches the side
    const posWrap = (o:Body) => {
      const a = o.pos.add(o.vel)
      const movWrap = () => 
          (Math.abs(o.pos.x - o.initalPos.x) > 80 ) ? new Vec(o.pos.x-(Math.sign(o.vel.x)*1), o.pos.y+12) : a
      return movWrap()
  }

    // Enemy Movement
    const moveEnemy = (o:Body) => <Body>{ 
      ...o,
      rotation: o.rotation + o.torque,
      angle:o.angle+o.rotation,
      vel: velWrap(o),
      pos: posWrap(o)
  };


    // Collision Processor
    const handleCollisions = (s:State) => {
      const
        bodiesCollided = ([a,b]:[Body,Body]) => a.pos.sub(b.pos).len() < a.radius + b.radius,
        shipCollided = s.bullets.filter(r=>bodiesCollided([s.ship,r])),
        collidedBullets0 = shipCollided.map(bullet=>bullet),
        
        allBulletsAndShields= flatMap(s.bullets, b=> s.shields.map(r=>([b,r]))),
        collidedBulletsAndShields = allBulletsAndShields.filter(bodiesCollided),
        collidedBullets = collidedBulletsAndShields.map(([bullet,_])=>bullet),
        collidedShields = collidedBulletsAndShields.map(([_,shield])=>shield),

        allBulletsAndEnemies= flatMap(s.bullets, b=> s.enemies.map(r=>([b,r]))),
        collidedBulletsAndEnemies = allBulletsAndEnemies.filter(bodiesCollided),
        collidedBullets2 = collidedBulletsAndEnemies.map(([bullet,_])=>bullet),
        collidedEnemies = collidedBulletsAndEnemies.map(([_,enemy])=>enemy),
        deadNum = collidedEnemies.map(a => parseInt(a.id.slice(7))),

        isEnd = s.enemies.filter(a=> a.pos.y >490).length > 0? true:false,

        texts = [
          <Texts>{id: 'score', content: 'Score: '+s.points.toString(), xpos: 40, ypos: 50, style: 'default'},
          <Texts>{id: 'lives', content: 'Lives: '+(shipCollided.length > 0? s.lives - 1 : s.lives).toString(), xpos: 455, ypos: 50, style: 'default'},
          <Texts>{id: 'level', content: 'Level: '+s.level.toString(), xpos: 250, ypos: 50, style: 'default'}
        ],
      

        // search for a body by id in an array
        elem = (a:ReadonlyArray<Body>) => (e:Body) => a.findIndex(b=>b.id === e.id) >= 0,
        // array a except anything in b
        except = (a:ReadonlyArray<Body>) => (b:Body[]) => a.filter(not(elem(b)))

      return <State>{ 
        ...s,
        bullets: except(except(except(s.bullets)(collidedBullets))(collidedBullets2))(collidedBullets0),
        shields: except(s.shields)(collidedShields),
        enemies: except(s.enemies)(collidedEnemies),
        exit: s.exit.concat(collidedBullets, collidedBullets2, collidedShields, collidedEnemies, collidedBullets0),
        lives: shipCollided.length > 0? s.lives - 1 : s.lives,
        deadEnemies: s.deadEnemies.concat(deadNum),
        textEle: texts,
        gameOver: s.gameOver || isEnd
      }
    }
  let subscription = sub(1, 1, 0)

  function flatMap<T,U>(a:ReadonlyArray<T>,f:(a:T)=>ReadonlyArray<U>): ReadonlyArray<U> {
    return Array.prototype.concat(...a.map(f));
  }
}
  
  // the following simply runs your pong function on window load.  Make sure to leave it in place.
  if (typeof window != 'undefined')
    window.onload = ()=>{
      spaceinvaders();
    }
  
  

