
import LikeButton from "./likebutton";
  
function Header({prout}) {
    return <h1>{prout ? prout : 'Default title'}</h1>;
}


export default function HomePage()
{
  
  const names = ['Ada Lovelace', 'Grace Hopper', 'Margaret Hamilton'];

  return(
    <div>
      <Header prout="React"/>
      <Header prout="Test"/>
      <ul>
        {names.map((name) => <li key={name}> {name}</li>)}
      </ul>
      <LikeButton/>
    </div>
  )
}

// root.render(<HomePage/>);
// const h1=document.createElement('h1');
// const p="TEST";
// const headcontent=document.createTextNode(p);
// h1.appendChild(headcontent);
// app.appendChild(h1);
// h1.style.backgroundColor="rgb(29, 113, 187)";





